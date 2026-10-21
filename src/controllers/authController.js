const authService = require('../services/authService');

const adminLogin = async (req, res, next) => {
  try {
    const result = await authService.adminLogin(req.body.username, req.body.password);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const employeeLogin = async (req, res, next) => {
  try {
    const result = await authService.employeeLogin(req.body.username, req.body.password);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }
    const result = await authService.refreshAccessToken(refreshToken);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { adminLogin, employeeLogin, refreshToken, logout };
