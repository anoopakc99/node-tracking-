const router = require('express').Router();
const photoController = require('../controllers/photoController');
const { authenticate } = require('../middleware/auth');
const { uploadPhoto } = require('../config/upload');

router.use(authenticate);

router.post('/capture', uploadPhoto.single('photo'), photoController.capturePhoto);
router.get('/', photoController.getPhotos);
router.get('/shop-visits', photoController.getShopVisits);
router.get('/:id', photoController.getPhotoById);

module.exports = router;
