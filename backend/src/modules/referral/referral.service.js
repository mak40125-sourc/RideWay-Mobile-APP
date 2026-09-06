const referralRepository = require('./referral.repository');
const { logger } = require('../../core/logger/logger');

const REWARD_AMOUNT = Number(process.env.REFERRAL_REWARD_AMOUNT || 100);
const EXPIRY_DAYS = Number(process.env.REFERRAL_EXPIRY_DAYS || 90);

exports.getReferralCode = async (userId) => {
  const { code, driver } = await referralRepository.getOrCreateDriverReferralCode(userId);
  const url = `https://velos.app/r/${code}`;
  return { referralCode: code, referralUrl: url, driverId: driver.id };
};

exports.applyReferral = async (riderId, referralCode) => {
  if (!referralCode || typeof referralCode !== 'string') {
    const e = new Error('referralCode required');
    e.status = 400;
    throw e;
  }
  const code = referralCode.trim().toUpperCase();
  // Basic format check VEL-XXXXX
  if (!/^VEL-[A-Z0-9]{5}$/.test(code)) {
    // Allow any code that exists; if format off, still try DB which will 404
  }
  const referral = await referralRepository.applyReferral(code, riderId);
  logger.info({ type: 'referral', event: 'apply', referralId: referral.id, riderId, code });
  return referral;
};

exports.tryRewardForRide = async (ride) => {
  if (!ride || ride.status !== 'RIDE_COMPLETED' || !ride.rider_id || Number(ride.fare) <= 0) return null;
  try {
    const result = await referralRepository.tryReward(ride.rider_id, ride.id);
    if (result) {
      logger.info({ type: 'referral', event: 'rewarded', referralId: result.id, riderId: ride.rider_id, rideId: ride.id, amount: result.reward_amount });
    }
    return result;
  } catch (e) {
    logger.error({ type: 'referral', event: 'reward_failed', riderId: ride.rider_id, rideId: ride.id, error: e.message });
    // Do not break ride completion
    return null;
  }
};

exports.getHistory = async (userId, opts={}) => {
  const driver = await referralRepository.getDriverByUserId(userId);
  if (!driver) { const e=new Error('Driver not found'); e.status=404; throw e; }
  const rows = await referralRepository.getDriverReferrals(driver.id, opts.limit, opts.offset);
  return rows;
};

exports.getStats = async (userId) => {
  const driver = await referralRepository.getDriverByUserId(userId);
  if (!driver) { const e=new Error('Driver not found'); e.status=404; throw e; }
  const stats = await referralRepository.getReferralStats(driver.id);
  const { code } = await referralRepository.getOrCreateDriverReferralCode(userId);
  return { ...stats, referralCode: code, referralUrl: `https://velos.app/r/${code}`, rewardAmount: REWARD_AMOUNT, expiryDays: EXPIRY_DAYS };
};

exports.getAll = async (userId, opts) => {
  return exports.getHistory(userId, opts);
};
