const router = require('express').Router();
const reportController = require('../controllers/reportController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/attendance', reportController.getAttendanceReport);
router.get('/tracking', reportController.getTrackingReport);
router.get('/breaks', reportController.getBreakReport);
router.get('/photos', reportController.getPhotoReport);

module.exports = router;
