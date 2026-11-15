const jwt = require('jsonwebtoken');
const config = require('../config');

const ALGORITHM = 'HS256';

if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
  console.warn('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET should be different values.');
}

/**
 * Generate Access Token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: config.ACCESS_TOKEN_EXPIRY,
    subject: 'accessApi'
  });
};

/**
 * Generate Refresh Token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: config.REFRESH_TOKEN_EXPIRY,
    subject: 'refreshApi'
  });
};

/**
 * Verify Access Token
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, config.JWT_ACCESS_SECRET, {
    algorithms: [ALGORITHM],
    subject: 'accessApi'
  });
};

/**
 * Verify Refresh Token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.JWT_REFRESH_SECRET, {
    algorithms: [ALGORITHM],
    subject: 'refreshApi'
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};