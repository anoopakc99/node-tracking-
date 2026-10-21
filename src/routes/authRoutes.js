const router = require('express').Router();
const authController = require('../controllers/authController');
const { validate, loginSchema } = require('../validators/schemas');

router.post('/admin/login', validate(loginSchema), authController.adminLogin);
router.post('/employee/login', validate(loginSchema), authController.employeeLogin);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

module.exports = router;
