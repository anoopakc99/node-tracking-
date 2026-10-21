const breakService = require('../services/breakService');

const startBreak = async (req, res, next) => {
  try {
    const result = await breakService.startBreak(req.user.id);
    res.json({ success: true, data: result, message: 'Break started' });
  } catch (error) {
    next(error);
  }
};

const endBreak = async (req, res, next) => {
  try {
    const result = await breakService.endBreak(req.user.id);
    res.json({ success: true, data: result, message: 'Break ended' });
  } catch (error) {
    next(error);
  }
};

const getStatus = async (req, res, next) => {
  try {
    const result = await breakService.getBreakStatus(req.user.id);
    res.json({ success: true, data: result });
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
    const result = await breakService.getBreakHistory(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { startBreak, endBreak, getStatus, getHistory };
