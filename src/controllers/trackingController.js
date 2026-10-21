const trackingService = require('../services/trackingService');

const saveLocations = async (req, res, next) => {
  try {
    const result = await trackingService.saveLocationBatch(req.user.id, req.body.locations);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getLiveTracking = async (req, res, next) => {
  try {
    const data = await trackingService.getLiveTracking();
    res.json({ success: true, data });
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
    const data = await trackingService.getLocationHistory(filters);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getStops = async (req, res, next) => {
  try {
    const filters = { ...req.query };
    if (req.user.role === 'employee') {
      filters.employeeId = req.user.id;
    }
    const data = await trackingService.getStopHistory(filters);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getRoute = async (req, res, next) => {
  try {
    const { employeeId, attendanceId, date } = req.query;
    if (req.user.role === 'employee' && employeeId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const data = await trackingService.getRouteHistory(employeeId, attendanceId, date);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { saveLocations, getLiveTracking, getHistory, getStops, getRoute };
