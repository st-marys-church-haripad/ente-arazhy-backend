/**
 * Admin Authorization Middleware
 * Ensures only ADMIN role members can access protected endpoints
 */
const adminOnly = (req, res, next) => {
  try {
    if (!req.user || !req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    /* Check user has ADMIN role (will be set by authenticate middleware after DB lookup) */
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    return next();
  } catch (error) {
    next(error);
  }
};

module.exports = adminOnly;
