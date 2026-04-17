const { query } = require('../config/db');

exports.getWalletBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await query(
      `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
       FROM wallet_transactions WHERE user_id = $1`,
      [userId]
    );
    res.status(200).json({ balance: Number(result.rows[0].balance) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getWalletTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;
    const result = await query(
      `SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPayment = async (req, res) => {
  try {
    const { rideId } = req.params;
    const result = await query('SELECT * FROM payments WHERE ride_id = $1', [rideId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.processPayment = async (req, res) => {
  try {
    const { rideId, method, amount } = req.body;
    const result = await query(
      `INSERT INTO payments (ride_id, amount, status, method)
       VALUES ($1, $2, 'completed', $3)
       RETURNING *`,
      [rideId, amount, method]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
