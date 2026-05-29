const mustResetPassword = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.mustResetPassword) {
    return res.status(403).json({
      success: false,
      code: 'PASSWORD_RESET_REQUIRED',
      message: 'Password reset is required before accessing this resource'
    });
  }

  return next();
};

module.exports = mustResetPassword;
