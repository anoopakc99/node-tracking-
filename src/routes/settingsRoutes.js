const router = require('express').Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, systemSettingsSchema } = require('../validators/schemas');

router.use(authenticate, requireAdmin);

router.get('/', settingsController.getSettings);
router.put('/', validate(systemSettingsSchema), settingsController.updateSettings);

module.exports = router;
