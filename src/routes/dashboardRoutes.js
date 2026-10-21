const router = require('express').Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/stats', dashboardController.getStats);
router.get('/weekly', dashboardController.getWeeklyAttendance);
router.get('/recent', dashboardController.getRecentActivity);

module.exports = router;
