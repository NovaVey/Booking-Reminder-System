function requireApiKey(req, res, next) {
  if (!process.env.API_KEY) {
    console.error('API_KEY is not set — refusing API request. Set API_KEY in .env.');
    return res.status(500).json({ error: 'Server misconfigured: API_KEY is not set' });
  }

  if (req.header('x-api-key') !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  next();
}

module.exports = requireApiKey;
