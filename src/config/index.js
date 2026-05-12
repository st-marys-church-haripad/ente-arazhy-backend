const dotenv = require('dotenv');

dotenv.config();

/**
 * Parse CORS whitelist from environment
 */
const parseWhitelistOrigins = () => {
  const envOrigins = process.env.WHITELIST_ORIGINS
    ? process.env.WHITELIST_ORIGINS.split(',').map((origin) => origin.trim())
    : [];
  return envOrigins.length > 0 ? envOrigins : ['http://localhost:3000'];
};

const config = {
  /* Server Configuration */
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  WHITELIST_ORIGINS: parseWhitelistOrigins(),

  /* Database Configuration */
  MONGO_URI: process.env.MONGO_URI,

  /* JWT Configuration */
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',

  /* Pagination Defaults */
  DEFAULT_RES_LIMIT: 50,
  DEFAULT_RES_OFFSET: 0,

  /* Email Configuration */
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT, 10) || 587,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@entearazhy.com',

  /* Frontend Configuration */
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000'
};

module.exports = config;