const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/:userId/balance', protect, walletController.getWalletBalance);
router.get('/:userId/transactions', protect, walletController.getWalletTransactions);
router.get('/payments/:rideId', protect, walletController.getPayment);
router.post('/payments/process', protect, walletController.processPayment);

module.exports = router;
