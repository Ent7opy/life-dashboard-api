const API_KEY = process.env.API_KEY;

function optionalAuth(req, res, next) {
  if (!API_KEY) return next();
  const provided = req.headers['x-api-key'];
  if (provided === API_KEY) return next();
  res.status(401).json({ error: 'Invalid API key' });
}

module.exports = { optionalAuth };
