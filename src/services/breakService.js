const prisma = require('../config/database');
const { getIO } = require('../sockets/socketManager');

const startBreak = async (employeeId) => {
  const activeSession = await prisma.attendanceSession.findFirst({
    where: { employeeId, status: 'active' }
  });

  if (!activeSession) {
    throw Object.assign(new Error('No active duty session. Please punch in first.'), { statusCode: 400 });
  }

  const activeBreak = await prisma.breakSession.findFirst({
    where: { attendanceId: activeSession.id, endTime: null }
  });

  if (activeBreak) {
    throw Object.assign(new Error('A break is already active'), { statusCode: 409 });
  }

  const settings = await prisma.employeeSettings.findUnique({
    where: { employeeId }
  });
  const breakAllowance = settings?.breakAllowance || 60;

  const completedBreaks = await prisma.breakSession.findMany({
    where: { attendanceId: activeSession.id, endTime: { not: null } }
  });

  const totalUsedBreak = completedBreaks.reduce((sum, b) => sum + (b.duration || 0), 0);

  if (totalUsedBreak >= breakAllowance) {
    throw Object.assign(
      new Error(`Your daily break allowance of ${breakAllowance} minutes has been completed. You cannot start another break.`),
      { statusCode: 400 }
    );
  }

  const remainingBreak = breakAllowance - totalUsedBreak;

  const breakSession = await prisma.breakSession.create({
    data: {
      employeeId,
      attendanceId: activeSession.id,
      startTime: new Date()
    }
  });

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeCode: true }
  });

  try {
    const io = getIO();
    io.to('admin-room').emit('employee:break_started', {
      employeeId,
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      breakStartTime: breakSession.startTime,
      totalUsedBreak,
      remainingBreak,
      sessionId: activeSession.id
    });
  } catch (e) {}

  return {
    breakSession,
    breakAllowance,
    totalUsedBreak,
    remainingBreak
  };
};

const endBreak = async (employeeId) => {
  const activeSession = await prisma.attendanceSession.findFirst({
    where: { employeeId, status: 'active' }
  });

  if (!activeSession) {
    throw Object.assign(new Error('No active duty session'), { statusCode: 400 });
  }

  const activeBreak = await prisma.breakSession.findFirst({
    where: { attendanceId: activeSession.id, endTime: null }
  });

  if (!activeBreak) {
    throw Object.assign(new Error('No active break found'), { statusCode: 404 });
  }

  const endTime = new Date();
  const duration = Math.floor((endTime - new Date(activeBreak.startTime)) / 60000);

  const settings = await prisma.employeeSettings.findUnique({
    where: { employeeId }
  });
  const breakAllowance = settings?.breakAllowance || 60;

  const completedBreaks = await prisma.breakSession.findMany({
    where: {
      attendanceId: activeSession.id,
      endTime: { not: null },
      id: { not: activeBreak.id }
    }
  });

  const previousBreakTime = completedBreaks.reduce((sum, b) => sum + (b.duration || 0), 0);
  const totalUsedBreak = previousBreakTime + duration;
  const isExcess = totalUsedBreak > breakAllowance;
  const excessDuration = isExcess ? totalUsedBreak - breakAllowance : 0;

  const updatedBreak = await prisma.breakSession.update({
    where: { id: activeBreak.id },
    data: {
      endTime,
      duration,
      isExcess,
      excessDuration,
      endReason: 'manual'
    }
  });

  const remainingBreak = Math.max(0, breakAllowance - totalUsedBreak);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeCode: true }
  });

  try {
    const io = getIO();
    io.to('admin-room').emit('employee:break_ended', {
      employeeId,
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      breakDuration: duration,
      totalUsedBreak,
      remainingBreak,
      isExcess,
      sessionId: activeSession.id
    });
  } catch (e) {}

  return {
    breakSession: updatedBreak,
    breakAllowance,
    totalUsedBreak,
    remainingBreak,
    isExcess,
    excessDuration
  };
};

const getBreakStatus = async (employeeId) => {
  const activeSession = await prisma.attendanceSession.findFirst({
    where: { employeeId, status: 'active' }
  });

  if (!activeSession) {
    return { hasActiveSession: false };
  }

  const settings = await prisma.employeeSettings.findUnique({
    where: { employeeId }
  });
  const breakAllowance = settings?.breakAllowance || 60;

  const allBreaks = await prisma.breakSession.findMany({
    where: { attendanceId: activeSession.id },
    orderBy: { startTime: 'asc' }
  });

  const activeBreak = allBreaks.find(b => !b.endTime);
  const completedBreaks = allBreaks.filter(b => b.endTime);
  const totalUsedBreak = completedBreaks.reduce((sum, b) => sum + (b.duration || 0), 0);

  let currentBreakDuration = 0;
  if (activeBreak) {
    currentBreakDuration = Math.floor((Date.now() - new Date(activeBreak.startTime)) / 60000);
  }

  const totalWithCurrent = totalUsedBreak + currentBreakDuration;
  const remainingBreak = Math.max(0, breakAllowance - totalWithCurrent);

  return {
    hasActiveSession: true,
    isOnBreak: !!activeBreak,
    activeBreak,
    breakAllowance,
    totalUsedBreak: totalWithCurrent,
    remainingBreak,
    completedBreaks: allBreaks,
    breakCount: allBreaks.length,
    isAllowanceExhausted: totalWithCurrent >= breakAllowance
  };
};

const getBreakHistory = async (filters = {}) => {
  const where = {};

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.attendanceId) where.attendanceId = filters.attendanceId;

  if (filters.startDate && filters.endDate) {
    where.startTime = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate)
    };
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const [breaks, total] = await Promise.all([
    prisma.breakSession.findMany({
      where,
      include: {
        employee: { select: { fullName: true, employeeCode: true } },
        attendance: { select: { date: true, punchInTime: true } }
      },
      orderBy: { startTime: 'desc' },
      skip,
      take: limit
    }),
    prisma.breakSession.count({ where })
  ]);

  return {
    breaks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

module.exports = {
  startBreak,
  endBreak,
  getBreakStatus,
  getBreakHistory
};
