const referralRoutes = require('./referral.routes');
const referralService = require('./referral.service');
const referralRepository = require('./referral.repository');
const referralController = require('./referral.controller');

module.exports = { referralRoutes, referralService, referralRepository, referralController };
