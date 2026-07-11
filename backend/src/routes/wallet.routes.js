const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/:userId/balance', protect, walletController.getWalletBalance);
router.get('/:userId/transactions', protect, walletController.getWalletTransactions);
module.exports = router;
