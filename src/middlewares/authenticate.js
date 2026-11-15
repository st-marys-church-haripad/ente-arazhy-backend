const mongoose = require('mongoose');
const { verifyAccessToken } = require('../lib/jwt');
const Member = require('../models/member.model');
const Token = require('../models/token.model');

/**
 * Authentication Middleware
 * Validates JWT token, checks it has not been revoked, and fetches role from database
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header missing or malformed'
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header missing or malformed'
      });
    }

    const jwtPayload = verifyAccessToken(token);
    const userId = jwtPayload?.id || jwtPayload?._id || jwtPayload?.userId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid access token payload'
      });
    }

    /* Member lookup and blacklist check run at the same time */
    const [user, isBlacklisted] = await Promise.all([
      Member.findById(userId)
        .select('role isActive mustResetPassword familyId +tokensValidAfter')
        .lean(),
      jwtPayload.jti
        ? Token.exists({ token: jwtPayload.jti, type: 'blacklist' })
        : null
    ]);

    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    /* Tokens issued before a password reset / forced sign-out are no longer valid */
    if (
      user.tokensValidAfter &&
      jwtPayload.iat < Math.floor(new Date(user.tokensValidAfter).getTime() / 1000)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked'
      });
    }

    /* Attach user data to request */
    req.userId = userId;
    req.tokenId = jwtPayload.jti || null;
    req.tokenExp = jwtPayload.exp || null;
    req.user = {
      _id: userId,
      id: userId,
      role: user.role,
      familyId: user.familyId || null,
      mustResetPassword: Boolean(user.mustResetPassword),
      userName: jwtPayload?.userName || jwtPayload?.username || null
    };

    return next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;