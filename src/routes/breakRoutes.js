const router = require('express').Router();
const breakController = require('../controllers/breakController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/start', breakController.startBreak);
router.post('/end', breakController.endBreak);
router.get('/status', breakController.getStatus);
router.get('/history', breakController.getHistory);

module.exports = router;
