const router = require('express').Router();
const trackingController = require('../controllers/trackingController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, locationBatchSchema } = require('../validators/schemas');

router.use(authenticate);

router.post('/locations/batch', validate(locationBatchSchema), trackingController.saveLocations);
router.get('/live', requireAdmin, trackingController.getLiveTracking);
router.get('/history', trackingController.getHistory);
router.get('/stops', trackingController.getStops);
router.get('/route', trackingController.getRoute);

module.exports = router;
