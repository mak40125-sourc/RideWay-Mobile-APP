const express = require('express');
const router = express.Router();
const controller = require('./referral.controller');
const { protect } = require('../../core/middleware/auth.middleware');

router.get('/code', protect, controller.getCode);
router.get('/stats', protect, controller.stats);
router.post('/apply', protect, controller.apply);
router.get('/history', protect, controller.history);
router.get('/', protect, controller.getAll);

module.exports = router;
