const rateLimit = require('express-rate-limit');

const tooManyRequests = (text) => ({
  success: false,
  error: text,
  message: text
});

const limiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 50, // limit each IP to 50 requests per windowMs
  standardHeaders: 'draft-8', // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: tooManyRequests('Too many requests, please try again later.'),
  skip: (req) => req.path === '/health'
});

// Login and token refresh: only failed attempts count
limiter.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: tooManyRequests('Too many attempts, please try again in a few minutes.')
});

// Forgot password and reset-with-code: every request counts
limiter.sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooManyRequests('Too many requests, please try again later.')
});

module.exports = limiter;