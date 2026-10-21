const router = require('express').Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate } = require('../middleware/auth');
const { validate, punchInSchema, punchOutSchema } = require('../validators/schemas');

router.use(authenticate);

router.post('/punch-in', validate(punchInSchema), attendanceController.punchIn);
router.post('/punch-out', validate(punchOutSchema), attendanceController.punchOut);
router.get('/today', attendanceController.getTodayAttendance);
router.get('/history', attendanceController.getHistory);
router.get('/summary', attendanceController.getSummary);

module.exports = router;
