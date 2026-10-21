const attendanceService = require('../services/attendanceService');

const punchIn = async (req, res, next) => {
  try {
    const session = await attendanceService.punchIn(req.user.id, req.body);
    res.status(201).json({ success: true, data: session, message: 'Punched in successfully' });
  } catch (error) {
    next(error);
  }
};

const punchOut = async (req, res, next) => {
  try {
    const session = await attendanceService.punchOut(req.user.id, req.body);
    res.json({ success: true, data: session, message: 'Punched out successfully' });
  } catch (error) {
    next(error);
  }
};

const getTodayAttendance = async (req, res, next) => {
  try {
    const employeeId = req.user.role === 'employee' ? req.user.id : req.query.employeeId;
    const session = await attendanceService.getTodayAttendance(employeeId);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const filters = { ...req.query };
    if (req.user.role === 'employee') {
      filters.employeeId = req.user.id;
    }
    const result = await attendanceService.getAttendanceHistory(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const employeeId = req.user.role === 'employee' ? req.user.id : req.query.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID required' });
    }
    const result = await attendanceService.getAttendanceSummary(employeeId, req.query.startDate, req.query.endDate);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { punchIn, punchOut, getTodayAttendance, getHistory, getSummary };
