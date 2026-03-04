const jwt = require('jsonwebtoken');
const config = require('../config');

const generateAccessToken = (payload) => {
    return jwt.sign(payload, config.JWT_ACCESS_SECRET, { 
        expiresIn: config.ACCESS_TOKEN_EXPIRY,
        subject: 'accessApi'
    });
}

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, config.JWT_REFRESH_SECRET, { 
        expiresIn: config.REFRESH_TOKEN_EXPIRY,
        subject: 'refreshApi'
    });
}

const verifyAccessToken = (token) => {
    return jwt.verify(token, config.JWT_ACCESS_SECRET, { subject: 'accessApi' });
}

const verifyRefreshToken = (token) => {
    return jwt.verify(token, config.JWT_REFRESH_SECRET, { subject: 'refreshApi' });
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};