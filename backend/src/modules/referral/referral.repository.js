const { supabaseAdmin } = require('../../core/database/supabase');

exports.getDriverByUserId = async (userId) => {
  const { data, error } = await supabaseAdmin.from('drivers').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
};

exports.ensureReferralCode = async (driverId) => {
  const { data, error } = await supabaseAdmin.from('drivers').select('referral_code').eq('id', driverId).maybeSingle();
  if (error) throw error;
  if (data && data.referral_code) return data.referral_code;
  const { data: updated, error: upErr } = await supabaseAdmin.rpc('generate_referral_code');
  // generate via DB if available, else fallback
  let code;
  if (!upErr && updated) code = updated;
  else code = 'VEL-' + Math.random().toString(36).slice(2,7).toUpperCase();
  const { data: patched, error: patchErr } = await supabaseAdmin.from('drivers').update({ referral_code: code }).eq('id', driverId).select('referral_code').maybeSingle();
  if (patchErr) throw patchErr;
  return patched.referral_code;
};

exports.getOrCreateDriverReferralCode = async (userId) => {
  const driver = await exports.getDriverByUserId(userId);
  if (!driver) {
    const e = new Error('Driver not found');
    e.status = 404;
    throw e;
  }
  if (driver.referral_code) return { code: driver.referral_code, driver };
  // Generate via DB function ensure_driver_referral_code trigger on update? Use direct generation
  const { data, error } = await supabaseAdmin.from('drivers').select('referral_code').eq('id', driver.id).maybeSingle();
  if (error) throw error;
  // Try to generate via RPC logic: call generate_referral_code then update
  let code;
  try {
    const { data: gen, error: genErr } = await supabaseAdmin.rpc('generate_referral_code');
    if (!genErr && gen) code = gen;
  } catch {}
  if (!code) code = 'VEL-' + Math.random().toString(36).slice(2,7).toUpperCase();
  for (let i=0;i<3;i++) {
    const { data: upd, error: updErr } = await supabaseAdmin.from('drivers').update({ referral_code: code }).eq('id', driver.id).select('referral_code').maybeSingle();
    if (!updErr && upd) return { code: upd.referral_code, driver: { ...driver, referral_code: upd.referral_code } };
    if (updErr && updErr.message.includes('duplicate')) {
      code = 'VEL-' + Math.random().toString(36).slice(2,7).toUpperCase();
      continue;
    }
    throw updErr;
  }
  throw new Error('Failed to generate referral code');
};

exports.applyReferral = async (referralCode, riderId) => {
  const { data, error } = await supabaseAdmin.rpc('apply_referral', {
    p_referral_code: referralCode,
    p_referred_rider_id: riderId,
  });
  if (error) {
    const msg = error.message || '';
    if (msg.includes('Invalid referral code')) { const e=new Error(msg); e.status=404; throw e; }
    if (msg.includes('already has a referral') || msg.includes('duplicate')) { const e=new Error('Rider already has a referral'); e.status=409; throw e; }
    if (msg.includes('Self-referral')) { const e=new Error(msg); e.status=400; throw e; }
    throw error;
  }
  return data;
};

exports.tryReward = async (riderId, rideId) => {
  const { data, error } = await supabaseAdmin.rpc('try_reward_referral', {
    p_rider_id: riderId,
    p_ride_id: rideId,
  });
  if (error) throw error;
  return data;
};

exports.getDriverReferrals = async (driverId, limit=50, offset=0) => {
  const { data, error } = await supabaseAdmin.from('referrals').select('*').eq('referrer_driver_id', driverId).order('created_at', { ascending:false }).range(offset, offset+limit-1);
  if (error) throw error;
  return data || [];
};

exports.getReferralStats = async (driverId) => {
  const { data, error } = await supabaseAdmin.from('referrals').select('status, reward_amount').eq('referrer_driver_id', driverId);
  if (error) throw error;
  const rows = data || [];
  const referred = rows.length;
  const pending = rows.filter(r=>r.status==='pending').length;
  const qualified = rows.filter(r=>r.status==='qualified').length;
  const rewarded = rows.filter(r=>r.status==='rewarded').length;
  const earned = rows.filter(r=>r.status==='rewarded').reduce((s,r)=>s+Number(r.reward_amount||0),0);
  return { referred, pending, qualified, rewarded, earned, completedFirstRide: rewarded };
};

exports.getRiderReferral = async (riderId) => {
  const { data, error } = await supabaseAdmin.from('referrals').select('*').eq('referred_rider_id', riderId).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if (error) throw error;
  return data;
};
