const router = require('express').Router();
const authenticate = require('../../middlewares/authenticate');
const adminOnly = require('../../middlewares/adminOnly');
const {
  register,
  login,
  refreshToken,
  logout,
  changePassword,
  changePasswordMe,
  sendFamilyHeadTemporaryPasswords,
  resetPassword,
  forgotPassword,
  resetPasswordWithToken
} = require('../../controllers/v1/auth/auth.controller');

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.post('/change-password-me', authenticate, changePasswordMe);
router.post('/family-heads/send-temporary-passwords', sendFamilyHeadTemporaryPasswords);
router.post('/change-password/:memberId', authenticate, changePassword);
router.post('/reset-password/:memberId', authenticate, resetPassword);

// // Forgot password routes (public)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password-with-code', require('../../controllers/v1/auth/auth.controller').resetPasswordWithCode);

module.exports = router;
