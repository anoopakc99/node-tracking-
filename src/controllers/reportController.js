const prisma = require('../config/database');

const getAttendanceReport = async (req, res, next) => {
  try {
    const { employeeId, department, startDate, endDate, status } = req.query;
    const where = {};

    if (employeeId) where.employeeId = employeeId;
    if (department) where.employee = { department };
    if (status) where.status = status;

    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: {
        employee: { select: { fullName: true, employeeCode: true, department: true, designation: true } },
        breakSessions: true
      },
      orderBy: { date: 'desc' }
    });

    const reportData = sessions.map(s => ({
      employeeName: s.employee.fullName,
      employeeCode: s.employee.employeeCode,
      department: s.employee.department,
      designation: s.employee.designation,
      date: s.date,
      punchIn: s.punchInTime,
      punchInLocation: s.punchInLat ? `${s.punchInLat}, ${s.punchInLng}` : 'N/A',
      punchOut: s.punchOutTime,
      punchOutLocation: s.punchOutLat ? `${s.punchOutLat}, ${s.punchOutLng}` : 'N/A',
      grossDutyMinutes: s.grossDuration || 0,
      breakMinutes: s.totalBreakTime || 0,
      netWorkingMinutes: s.netWorkingTime || 0,
      status: s.status,
      breakCount: s.breakSessions.length
    }));

    res.json({ success: true, data: { report: reportData, total: reportData.length } });
  } catch (error) {
    next(error);
  }
};

const getTrackingReport = async (req, res, next) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const where = {};

    if (employeeId) where.employeeId = employeeId;
    if (startDate && endDate) {
      where.arrivalTime = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const stops = await prisma.employeeStop.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeCode: true } } },
      orderBy: { arrivalTime: 'desc' }
    });

    res.json({ success: true, data: { report: stops, total: stops.length } });
  } catch (error) {
    next(error);
  }
};

const getBreakReport = async (req, res, next) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const where = {};

    if (employeeId) where.employeeId = employeeId;
    if (startDate && endDate) {
      where.startTime = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const breaks = await prisma.breakSession.findMany({
      where,
      include: {
        employee: { select: { fullName: true, employeeCode: true } },
        attendance: { select: { date: true } }
      },
      orderBy: { startTime: 'desc' }
    });

    const reportData = breaks.map(b => ({
      employeeName: b.employee.fullName,
      employeeCode: b.employee.employeeCode,
      date: b.attendance.date,
      startTime: b.startTime,
      endTime: b.endTime,
      duration: b.duration || 0,
      isExcess: b.isExcess,
      excessDuration: b.excessDuration || 0,
      autoEnded: b.autoEnded,
      endReason: b.endReason
    }));

    res.json({ success: true, data: { report: reportData, total: reportData.length } });
  } catch (error) {
    next(error);
  }
};

const getPhotoReport = async (req, res, next) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const where = {};

    if (employeeId) where.employeeId = employeeId;
    if (startDate && endDate) {
      where.captureTimestamp = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const photos = await prisma.capturedPhoto.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeCode: true } } },
      orderBy: { captureTimestamp: 'desc' }
    });

    res.json({ success: true, data: { report: photos, total: photos.length } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAttendanceReport, getTrackingReport, getBreakReport, getPhotoReport };
