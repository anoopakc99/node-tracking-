const prisma = require('../config/database');
const { getIO } = require('../sockets/socketManager');

const saveLocationBatch = async (employeeId, locations) => {
  const activeSession = await prisma.attendanceSession.findFirst({
    where: { employeeId, status: 'active' }
  });

  if (!activeSession) {
    throw Object.assign(new Error('No active duty session'), { statusCode: 400 });
  }

  const validLocations = locations.filter(loc => {
    if (loc.latitude < -90 || loc.latitude > 90) return false;
    if (loc.longitude < -180 || loc.longitude > 180) return false;
    if (loc.accuracy && loc.accuracy > 500) return false;
    return true;
  });

  if (validLocations.length === 0) {
    return { saved: 0, rejected: locations.length };
  }

  const existingEventIds = [];
  const eventIds = validLocations.filter(l => l.eventId).map(l => l.eventId);
  if (eventIds.length > 0) {
    const existing = await prisma.employeeLocation.findMany({
      where: { eventId: { in: eventIds } },
      select: { eventId: true }
    });
    existingEventIds.push(...existing.map(e => e.eventId));
  }

  const newLocations = validLocations.filter(
    loc => !loc.eventId || !existingEventIds.includes(loc.eventId)
  );

  if (newLocations.length === 0) {
    return { saved: 0, duplicates: locations.length };
  }

  const locationData = newLocations.map(loc => ({
    employeeId,
    attendanceId: activeSession.id,
    latitude: loc.latitude,
    longitude: loc.longitude,
    accuracy: loc.accuracy,
    speed: loc.speed,
    heading: loc.heading,
    altitude: loc.altitude,
    deviceTimestamp: new Date(loc.deviceTimestamp),
    locationSource: loc.locationSource || 'gps',
    isOfflineSync: loc.isOfflineSync || false,
    batteryLevel: loc.batteryLevel,
    eventId: loc.eventId
  }));

  await prisma.employeeLocation.createMany({ data: locationData });

  const lastLocation = newLocations[newLocations.length - 1];

  await prisma.trackingSession.updateMany({
    where: { attendanceId: activeSession.id, status: 'active' },
    data: {
      lastLatitude: lastLocation.latitude,
      lastLongitude: lastLocation.longitude,
      lastUpdateTime: new Date(),
      totalPoints: { increment: newLocations.length }
    }
  });

  await processStopDetection(employeeId, activeSession.id);

  try {
    const io = getIO();
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { fullName: true, employeeCode: true }
    });

    io.to('admin-room').emit('employee:location_updated', {
      employeeId,
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      location: {
        lat: lastLocation.latitude,
        lng: lastLocation.longitude,
        accuracy: lastLocation.accuracy,
        speed: lastLocation.speed,
        timestamp: new Date().toISOString()
      },
      sessionId: activeSession.id
    });
  } catch (e) {}

  return { saved: newLocations.length, rejected: locations.length - newLocations.length };
};

const processStopDetection = async (employeeId, attendanceId) => {
  const settings = await prisma.employeeSettings.findUnique({
    where: { employeeId }
  });

  const stopRadius = settings?.stopDetectionRadius || 50;
  const stopDuration = settings?.stopDetectionDuration || 10;

  const recentLocations = await prisma.employeeLocation.findMany({
    where: { employeeId, attendanceId },
    orderBy: { deviceTimestamp: 'desc' },
    take: 50
  });

  if (recentLocations.length < 3) return;

  const reversed = [...recentLocations].reverse();
  let clusterStart = 0;

  while (clusterStart < reversed.length) {
    const anchor = reversed[clusterStart];
    let clusterEnd = clusterStart;

    for (let i = clusterStart + 1; i < reversed.length; i++) {
      const distance = calculateDistance(
        anchor.latitude, anchor.longitude,
        reversed[i].latitude, reversed[i].longitude
      );
      if (distance <= stopRadius) {
        clusterEnd = i;
      } else {
        break;
      }
    }

    if (clusterEnd > clusterStart) {
      const startTime = reversed[clusterStart].deviceTimestamp;
      const endTime = reversed[clusterEnd].deviceTimestamp;
      const durationMinutes = (new Date(endTime) - new Date(startTime)) / 60000;

      if (durationMinutes >= stopDuration) {
        const sampleCount = clusterEnd - clusterStart + 1;
        const avgLat = reversed.slice(clusterStart, clusterEnd + 1).reduce((s, l) => s + l.latitude, 0) / sampleCount;
        const avgLng = reversed.slice(clusterStart, clusterEnd + 1).reduce((s, l) => s + l.longitude, 0) / sampleCount;

        const existingStop = await prisma.employeeStop.findFirst({
          where: {
            employeeId,
            attendanceId,
            arrivalTime: { gte: new Date(new Date(startTime).getTime() - 120000), lte: new Date(new Date(startTime).getTime() + 120000) }
          }
        });

        if (!existingStop) {
          await prisma.employeeStop.create({
            data: {
              employeeId,
              attendanceId,
              latitude: avgLat,
              longitude: avgLng,
              accuracy: anchor.accuracy,
              arrivalTime: startTime,
              departureTime: endTime,
              duration: Math.round(durationMinutes),
              isQualifying: durationMinutes >= stopDuration,
              sampleCount
            }
          });
        } else {
          if (new Date(endTime) > new Date(existingStop.departureTime || existingStop.arrivalTime)) {
            await prisma.employeeStop.update({
              where: { id: existingStop.id },
              data: {
                departureTime: endTime,
                duration: Math.round(durationMinutes),
                sampleCount
              }
            });
          }
        }
      }
    }

    clusterStart = clusterEnd + 1;
  }
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getLiveTracking = async () => {
  const activeSessions = await prisma.attendanceSession.findMany({
    where: { status: 'active' },
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          department: true,
          designation: true,
          profileImage: true
        }
      },
      trackingSessions: { where: { status: 'active' }, take: 1 },
      breakSessions: { where: { endTime: null }, take: 1 },
      locations: {
        orderBy: { deviceTimestamp: 'desc' },
        take: 1
      }
    }
  });

  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

  return activeSessions.map(session => {
    const tracking = session.trackingSessions[0];
    const latestLoc = session.locations[0];
    const isOnBreak = session.breakSessions.length > 0;
    const lastUpdate = tracking?.lastUpdateTime || latestLoc?.deviceTimestamp || null;
    const isStale = !lastUpdate || new Date(lastUpdate) < staleThreshold;

    const lat = tracking?.lastLatitude ?? latestLoc?.latitude ?? null;
    const lng = tracking?.lastLongitude ?? latestLoc?.longitude ?? null;
    const accuracy = latestLoc?.accuracy ?? null;
    const speed = latestLoc?.speed ?? null;
    const batteryLevel = latestLoc?.batteryLevel ?? null;

    return {
      employeeId: session.employee.id,
      employeeName: session.employee.fullName,
      fullName: session.employee.fullName,
      employeeCode: session.employee.employeeCode,
      department: session.employee.department,
      designation: session.employee.designation,
      profileImage: session.employee.profileImage,
      sessionId: session.id,
      attendanceId: session.id,
      punchInTime: session.punchInTime,
      latitude: lat,
      longitude: lng,
      accuracy,
      speed,
      batteryLevel,
      lastUpdated: lastUpdate,
      location: (lat !== null && lng !== null) ? {
        lat,
        lng,
        lastUpdate,
        accuracy,
        speed,
        batteryLevel
      } : null,
      isOnBreak,
      isStale,
      dutyStatus: isOnBreak ? 'break' : (isStale ? 'stale' : 'active'),
      status: isOnBreak ? 'on_break' : (isStale ? 'stale_gps' : 'working'),
      dutyDuration: Math.floor((Date.now() - new Date(session.punchInTime)) / 60000)
    };
  });
};

const getLocationHistory = async (filters = {}) => {
  const where = {};

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.attendanceId) where.attendanceId = filters.attendanceId;

  if (filters.startDate && filters.endDate) {
    where.deviceTimestamp = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate)
    };
  }

  const locations = await prisma.employeeLocation.findMany({
    where,
    orderBy: { deviceTimestamp: 'asc' },
    take: parseInt(filters.limit) || 1000
  });

  return locations;
};

const getStopHistory = async (filters = {}) => {
  const where = {};

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.attendanceId) where.attendanceId = filters.attendanceId;
  if (filters.qualifying !== undefined) where.isQualifying = filters.qualifying === 'true';

  if (filters.startDate && filters.endDate) {
    where.arrivalTime = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate)
    };
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const [stops, total] = await Promise.all([
    prisma.employeeStop.findMany({
      where,
      include: {
        employee: { select: { fullName: true, employeeCode: true } }
      },
      orderBy: { arrivalTime: 'desc' },
      skip,
      take: limit
    }),
    prisma.employeeStop.count({ where })
  ]);

  return {
    stops,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

const getRouteHistory = async (employeeId, attendanceId, date) => {
  const where = {};
  if (employeeId) where.employeeId = employeeId;
  if (attendanceId) where.attendanceId = attendanceId;
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.deviceTimestamp = { gte: start, lte: end };
  }

  const locations = await prisma.employeeLocation.findMany({
    where,
    orderBy: { deviceTimestamp: 'asc' }
  });

  let totalDistance = 0;
  for (let i = 1; i < locations.length; i++) {
    const dist = calculateDistance(
      locations[i - 1].latitude, locations[i - 1].longitude,
      locations[i].latitude, locations[i].longitude
    );
    if (dist < 10000) {
      totalDistance += dist;
    }
  }

  const stopWhere = {};
  if (employeeId) stopWhere.employeeId = employeeId;
  if (attendanceId) stopWhere.attendanceId = attendanceId;
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    stopWhere.arrivalTime = { gte: start, lte: end };
  }

  const stops = await prisma.employeeStop.findMany({
    where: stopWhere,
    orderBy: { arrivalTime: 'asc' }
  });

  return {
    locations,
    path: locations,
    stops,
    totalDistance: Math.round(totalDistance),
    totalPoints: locations.length
  };
};

module.exports = {
  saveLocationBatch,
  getLiveTracking,
  getLocationHistory,
  getStopHistory,
  getRouteHistory,
  calculateDistance
};
