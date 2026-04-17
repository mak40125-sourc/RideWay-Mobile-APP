const { supabaseAdmin } = require('../config/supabase');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  // In SDK 54/55 environments, ensure we verify the user via the admin client for backend routes
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  req.user = data.user;
  next();
};

module.exports = { protect };