const { supabaseAdmin } = require('../config/supabase');

exports.getWalletBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabaseAdmin.rpc('get_balance', {
      p_user_id: userId,
    });

    if (error) throw error;
    res.status(200).json({ balance: Number(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getWalletTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;
    const { data, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (error) throw error;
    res.status(200).json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


