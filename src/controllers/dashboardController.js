const dashboardService = require('../services/dashboardService');

const getStats = async (req, res, next) => {
  try {
    const stats = await dashboardService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

const getWeeklyAttendance = async (req, res, next) => {
  try {
    const data = await dashboardService.getWeeklyAttendance();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getRecentActivity = async (req, res, next) => {
  try {
    const data = await dashboardService.getRecentActivity();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStats, getWeeklyAttendance, getRecentActivity };
