const router = require('express').Router();
const authenticate = require('../../middlewares/authenticate');
const {
  register,
  login,
  refreshToken,
  logout,
  changePassword,
  resetPassword,
  forgotPassword,
  resetPasswordWithToken
} = require('../../controllers/v1/auth/auth.controller');

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.post('/change-password/:memberId', authenticate, changePassword);
router.post('/reset-password/:memberId', resetPassword);

// // Forgot password routes (public)
// router.post('/forgot-password', forgotPassword);
// router.post('/reset-password-with-token', resetPasswordWithToken);

module.exports = router;
