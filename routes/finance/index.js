const express = require('express');
const router = express.Router();

router.use('/transactions', require('./transactions'));
router.use('/categories', require('./categories'));
router.use('/payment-methods', require('./paymentMethods'));
router.use('/cards', require('./cards'));
router.use('/investments', require('./investments'));
router.use('/goals', require('./goals'));
router.use('/import', require('./import'));
router.use('/settings', require('./settings'));
router.use('/home', require('./home'));

module.exports = router;
