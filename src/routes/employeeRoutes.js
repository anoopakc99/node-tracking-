const router = require('express').Router();
const employeeController = require('../controllers/employeeController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, createEmployeeSchema, updateEmployeeSchema } = require('../validators/schemas');

router.use(authenticate);
router.use(requireAdmin);

router.get('/', employeeController.getAllEmployees);
router.post('/', validate(createEmployeeSchema), employeeController.createEmployee);
router.get('/departments', employeeController.getDepartments);
router.get('/:id', employeeController.getEmployeeById);
router.put('/:id', validate(updateEmployeeSchema), employeeController.updateEmployee);
router.patch('/:id/status', employeeController.toggleStatus);
router.patch('/:id/reset-password', employeeController.resetPassword);

module.exports = router;
