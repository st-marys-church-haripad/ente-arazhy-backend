const { verifyAccessToken } = require('../lib/jwt');
const Member = require('../models/member.model');

/**
 * Authentication Middleware
 * Validates JWT token, extracts user information, and fetches role from database
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

    const token = authHeader.substring(7);
    const jwtPayload = verifyAccessToken(token);
    const userId = jwtPayload?.id || jwtPayload?._id || jwtPayload?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid access token payload'
      });
    }

    /* Fetch current user role from database for authorization checks */
    const user = await Member.findById(userId).select('role isActive mustResetPassword');
    
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

    /* Attach user data to request */
    req.userId = userId;
    req.user = {
      _id: userId,
      id: userId,
      role: user.role,
      mustResetPassword: Boolean(user.mustResetPassword),
      userName: jwtPayload?.userName || jwtPayload?.username || null
    };

    return next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;