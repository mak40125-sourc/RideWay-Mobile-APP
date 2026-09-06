const referralService = require('./referral.service');

exports.getCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await referralService.getReferralCode(userId);
    res.status(200).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

exports.apply = async (req, res) => {
  try {
    const riderId = req.user.id;
    const { referralCode } = req.body;
    // Reject if caller is a driver (role check if available)
    // We check via profiles role
    const { supabaseAdmin } = require('../../core/database/supabase');
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', riderId).maybeSingle();
    if (profile && profile.role === 'driver') {
      return res.status(403).json({ error: 'Drivers cannot apply referral as rider' });
    }
    const referral = await referralService.applyReferral(riderId, referralCode);
    res.status(201).json(referral);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

exports.history = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const rows = await referralService.getHistory(userId, { limit, offset });
    res.status(200).json(rows);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const userId = req.user.id;
    // Enforce driver-only
    const { supabaseAdmin } = require('../../core/database/supabase');
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (profile && profile.role !== 'driver') {
      return res.status(403).json({ error: 'Only drivers can view referrals' });
    }
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const rows = await referralService.getAll(userId, { limit, offset });
    res.status(200).json(rows);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

exports.stats = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await referralService.getStats(userId);
    res.status(200).json(stats);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
