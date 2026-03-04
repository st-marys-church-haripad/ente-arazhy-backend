const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 50, // limit each IP to 50 requests per windowMs
  standardHeaders: 'draft-8', // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests, please try again later.',
  }
});

module.exports = limiter;