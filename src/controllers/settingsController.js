const settingsService = require('../services/settingsService');

const getSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getSystemSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateSystemSettings(req.body);
    res.json({ success: true, data: settings, message: 'Settings updated' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSettings, updateSettings };
