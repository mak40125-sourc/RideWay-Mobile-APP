const { supabaseAdmin } = require('../../core/database/supabase');

// Phase 2A: the wallet module has no service layer yet, so this repository
// holds the storage calls currently embedded in wallet.controller.js.
// Phase 2B introduces wallet.service.js and migrates the controller onto it.

exports.getBalance = async (userId) => {
  const { data, error } = await supabaseAdmin.rpc('get_balance', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
};

exports.getTransactions = async (userId, limit = 20) => {
  const { data, error } = await supabaseAdmin
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Number(limit));
  if (error) throw error;
  return data || [];
};
