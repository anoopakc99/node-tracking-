const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');
const { thumbnailsDir } = require('../config/upload');
const { getIO } = require('../sockets/socketManager');

const capturePhoto = async (employeeId, data, file) => {
  let activeSession = await prisma.attendanceSession.findFirst({
    where: { employeeId, status: 'active' }
  });

  if (!activeSession) {
    activeSession = await prisma.attendanceSession.findFirst({
      where: { employeeId },
      orderBy: { punchInTime: 'desc' }
    });
  }

  if (!activeSession) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activeSession = await prisma.attendanceSession.create({
      data: {
        employeeId,
        date: today,
        punchInTime: new Date(),
        punchInLat: data.latitude ? parseFloat(data.latitude) : 28.6139,
        punchInLng: data.longitude ? parseFloat(data.longitude) : 77.2090,
        punchInAccuracy: data.accuracy ? parseFloat(data.accuracy) : 10.0,
        status: 'active'
      }
    });
  }

  if (!file) {
    throw Object.assign(new Error('Photo file is required'), { statusCode: 400 });
  }

  let thumbnailPath = null;
  try {
    const thumbFilename = `thumb_${path.basename(file.filename)}`;
    const fullThumbPath = path.join(thumbnailsDir, thumbFilename);
    fs.copyFileSync(file.path, fullThumbPath);
    thumbnailPath = `thumbnails/${thumbFilename}`;
  } catch (e) {
    thumbnailPath = `photos/${file.filename}`;
  }

  const captureTime = data.captureTimestamp && !isNaN(new Date(data.captureTimestamp).getTime())
    ? new Date(data.captureTimestamp)
    : new Date();

  const photo = await prisma.$transaction(async (tx) => {
    let shopVisit = null;

    if (data.shopName) {
      shopVisit = await tx.shopVisit.create({
        data: {
          employeeId,
          attendanceId: activeSession.id,
          shopName: data.shopName,
          description: data.description,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          accuracy: data.accuracy ? parseFloat(data.accuracy) : null,
          visitTime: captureTime
        }
      });
    }

    const capturedPhoto = await tx.capturedPhoto.create({
      data: {
        employeeId,
        attendanceId: activeSession.id,
        shopVisitId: shopVisit?.id,
        shopName: data.shopName,
        description: data.description,
        imagePath: `photos/${file.filename}`,
        thumbnailPath,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        accuracy: data.accuracy ? parseFloat(data.accuracy) : null,
        captureTimestamp: captureTime,
        fileSize: file.size,
        mimeType: file.mimetype
      }
    });

    return capturedPhoto;
  });

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeCode: true, department: true }
  });

  const photoPayload = {
    employeeId,
    employeeName: employee?.fullName || 'Field Employee',
    employeeCode: employee?.employeeCode || 'EMP',
    department: employee?.department || 'Field Ops',
    photoId: photo.id,
    shopName: data.shopName || 'Store Visit',
    description: data.description,
    imagePath: photo.imagePath,
    thumbnailPath: photo.thumbnailPath,
    location: data.latitude ? { lat: parseFloat(data.latitude), lng: parseFloat(data.longitude), accuracy: data.accuracy ? parseFloat(data.accuracy) : 10 } : null,
    latitude: data.latitude ? parseFloat(data.latitude) : null,
    longitude: data.longitude ? parseFloat(data.longitude) : null,
    timestamp: photo.captureTimestamp
  };

  try {
    const io = getIO();
    io.to('admin-room').emit('employee:photo_uploaded', photoPayload);
    io.to('admin-room').emit('employee:photo_captured', photoPayload);
  } catch (e) {}

  return photo;
};

const getPhotos = async (filters = {}) => {
  const where = {};

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.attendanceId) where.attendanceId = filters.attendanceId;

  if (filters.date) {
    const start = new Date(filters.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.date);
    end.setHours(23, 59, 59, 999);
    where.captureTimestamp = { gte: start, lte: end };
  } else if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    where.captureTimestamp = { gte: start, lte: end };
  } else if (filters.startDate) {
    where.captureTimestamp = { gte: new Date(filters.startDate) };
  } else if (filters.endDate) {
    where.captureTimestamp = { lte: new Date(filters.endDate) };
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const skip = (page - 1) * limit;

  const [photos, total] = await Promise.all([
    prisma.capturedPhoto.findMany({
      where,
      include: {
        employee: { select: { fullName: true, employeeCode: true, department: true } }
      },
      orderBy: { captureTimestamp: 'desc' },
      skip,
      take: limit
    }),
    prisma.capturedPhoto.count({ where })
  ]);

  return {
    photos,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

const getPhotoById = async (id) => {
  const photo = await prisma.capturedPhoto.findUnique({
    where: { id },
    include: {
      employee: { select: { fullName: true, employeeCode: true } },
      shopVisit: true
    }
  });

  if (!photo) {
    throw Object.assign(new Error('Photo not found'), { statusCode: 404 });
  }

  return photo;
};

const getShopVisits = async (filters = {}) => {
  const where = {};

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.attendanceId) where.attendanceId = filters.attendanceId;

  if (filters.startDate && filters.endDate) {
    where.visitTime = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate)
    };
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const [visits, total] = await Promise.all([
    prisma.shopVisit.findMany({
      where,
      include: {
        employee: { select: { fullName: true, employeeCode: true } },
        photos: { select: { id: true, thumbnailPath: true, imagePath: true } }
      },
      orderBy: { visitTime: 'desc' },
      skip,
      take: limit
    }),
    prisma.shopVisit.count({ where })
  ]);

  return {
    visits,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

module.exports = {
  capturePhoto,
  getPhotos,
  getPhotoById,
  getShopVisits
};
