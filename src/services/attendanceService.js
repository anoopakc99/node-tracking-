const prisma = require('../config/database');
const { getIO } = require('../sockets/socketManager');

const punchIn = async (employeeId, data) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingSession = await prisma.attendanceSession.findFirst({
    where: {
      employeeId,
      status: 'active'
    }
  });

  if (existingSession) {
    const hoursSincePunchIn = (Date.now() - new Date(existingSession.punchInTime).getTime()) / (1000 * 60 * 60);
    if (hoursSincePunchIn > 18) {
      const autoEndTime = new Date(new Date(existingSession.punchInTime).getTime() + 9 * 60 * 60 * 1000);
      await prisma.attendanceSession.update({
        where: { id: existingSession.id },
        data: {
          punchOutTime: autoEndTime,
          status: 'completed',
          netWorkingTime: 540
        }
      });
      await prisma.trackingSession.updateMany({
        where: { attendanceId: existingSession.id, status: 'active' },
        data: { endTime: autoEndTime, status: 'completed' }
      });
    } else {
      throw Object.assign(new Error('You already have an active duty session'), { statusCode: 409 });
    }
  }

  const session = await prisma.$transaction(async (tx) => {
    const attendance = await tx.attendanceSession.create({
      data: {
        employeeId,
        date: today,
        punchInTime: new Date(),
        punchInLat: data.latitude,
        punchInLng: data.longitude,
        punchInAccuracy: data.accuracy,
        status: 'active',
        deviceInfo: data.deviceInfo
      }
    });

    await tx.trackingSession.create({
      data: {
        employeeId,
        attendanceId: attendance.id,
        startTime: new Date(),
        status: 'active'
      }
    });

    return attendance;
  });

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeCode: true }
  });

  try {
    const io = getIO();
    io.to('admin-room').emit('employee:punched_in', {
      employeeId,
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      punchInTime: session.punchInTime,
      location: { lat: data.latitude, lng: data.longitude, accuracy: data.accuracy },
      sessionId: session.id
    });
  } catch (e) {}

  return session;
};

const punchOut = async (employeeId, data) => {
  const activeSession = await prisma.attendanceSession.findFirst({
    where: { employeeId, status: 'active' },
    include: { breakSessions: true }
  });

  if (!activeSession) {
    throw Object.assign(new Error('No active duty session found'), { statusCode: 404 });
  }

  const punchOutTime = new Date();
  const punchInTime = new Date(activeSession.punchInTime);
  const grossDuration = Math.floor((punchOutTime - punchInTime) / 60000);

  let totalBreakTime = 0;
  let excessBreakTime = 0;

  const settings = await prisma.employeeSettings.findUnique({
    where: { employeeId }
  });
  const breakAllowance = settings?.breakAllowance || 60;

  const result = await prisma.$transaction(async (tx) => {
    const activeBreak = await tx.breakSession.findFirst({
      where: { attendanceId: activeSession.id, endTime: null }
    });

    if (activeBreak) {
      const breakDuration = Math.floor((punchOutTime - new Date(activeBreak.startTime)) / 60000);
      await tx.breakSession.update({
        where: { id: activeBreak.id },
        data: {
          endTime: punchOutTime,
          duration: breakDuration,
          autoEnded: true,
          endReason: 'punch_out'
        }
      });
    }

    const allBreaks = await tx.breakSession.findMany({
      where: { attendanceId: activeSession.id }
    });

    totalBreakTime = allBreaks.reduce((sum, b) => {
      if (b.duration) return sum + b.duration;
      if (b.endTime) return sum + Math.floor((new Date(b.endTime) - new Date(b.startTime)) / 60000);
      return sum + Math.floor((punchOutTime - new Date(b.startTime)) / 60000);
    }, 0);

    if (totalBreakTime > breakAllowance) {
      excessBreakTime = totalBreakTime - breakAllowance;
    }

    const netWorkingTime = grossDuration - totalBreakTime;

    const attendance = await tx.attendanceSession.update({
      where: { id: activeSession.id },
      data: {
        punchOutTime,
        punchOutLat: data.latitude,
        punchOutLng: data.longitude,
        punchOutAccuracy: data.accuracy,
        grossDuration,
        totalBreakTime,
        netWorkingTime: Math.max(0, netWorkingTime),
        excessBreakTime,
        status: 'completed'
      }
    });

    await tx.trackingSession.updateMany({
      where: { attendanceId: activeSession.id, status: 'active' },
      data: { endTime: punchOutTime, status: 'completed' }
    });

    return attendance;
  });

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeCode: true }
  });

  try {
    const io = getIO();
    io.to('admin-room').emit('employee:punched_out', {
      employeeId,
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      punchOutTime,
      grossDuration,
      totalBreakTime,
      netWorkingTime: Math.max(0, grossDuration - totalBreakTime),
      sessionId: activeSession.id
    });
  } catch (e) {}

  return result;
};

const getTodayAttendance = async (employeeId) => {
  // First check if there is an active session
  const activeSession = await prisma.attendanceSession.findFirst({
    where: {
      employeeId,
      status: 'active'
    },
    include: {
      breakSessions: { orderBy: { startTime: 'asc' } }
    },
    orderBy: { punchInTime: 'desc' }
  });

  if (activeSession) {
    return activeSession;
  }

  // Otherwise check for session completed today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const session = await prisma.attendanceSession.findFirst({
    where: {
      employeeId,
      punchInTime: {
        gte: todayStart
      }
    },
    include: {
      breakSessions: { orderBy: { startTime: 'asc' } }
    },
    orderBy: { punchInTime: 'desc' }
  });

  return session;
};

const getAttendanceHistory = async (filters = {}) => {
  const where = {};

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.department) {
    where.employee = { department: filters.department };
  }

  if (filters.startDate && filters.endDate) {
    where.date = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate)
    };
  } else if (filters.date) {
    where.date = new Date(filters.date);
  }

  if (filters.status) where.status = filters.status;

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where,
      include: {
        employee: { select: { fullName: true, employeeCode: true, department: true, designation: true } },
        breakSessions: true,
        capturedPhotos: {
          select: {
            id: true,
            shopName: true,
            description: true,
            imagePath: true,
            thumbnailPath: true,
            latitude: true,
            longitude: true,
            accuracy: true,
            captureTimestamp: true
          }
        }
      },
      orderBy: { punchInTime: 'desc' },
      skip,
      take: limit
    }),
    prisma.attendanceSession.count({ where })
  ]);

  return {
    sessions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

const getAttendanceSummary = async (employeeId, startDate, endDate) => {
  const where = { employeeId };

  if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  const sessions = await prisma.attendanceSession.findMany({
    where,
    include: { breakSessions: true },
    orderBy: { date: 'desc' }
  });

  const totalDays = sessions.length;
  const completedDays = sessions.filter(s => s.status === 'completed').length;
  const totalGrossDuration = sessions.reduce((sum, s) => sum + (s.grossDuration || 0), 0);
  const totalBreakTime = sessions.reduce((sum, s) => sum + (s.totalBreakTime || 0), 0);
  const totalNetWorking = sessions.reduce((sum, s) => sum + (s.netWorkingTime || 0), 0);
  const avgWorkingHours = completedDays > 0 ? totalNetWorking / completedDays : 0;

  return {
    totalDays,
    completedDays,
    activeDays: sessions.filter(s => s.status === 'active').length,
    totalGrossDuration,
    totalBreakTime,
    totalNetWorking,
    avgWorkingHours: Math.round(avgWorkingHours),
    sessions
  };
};

module.exports = {
  punchIn,
  punchOut,
  getTodayAttendance,
  getAttendanceHistory,
  getAttendanceSummary
};
