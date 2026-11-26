const router = require('express').Router();
const authenticate = require('../../middlewares/authenticate');
const authorizeRoles = require('../../middlewares/authorizeRoles');
const mustResetPassword = require('../../middlewares/mustResetPassword');
const limiter = require('../../lib/express_rate_limit');
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
  resetPasswordWithCode
} = require('../../controllers/v1/auth/auth.controller');

// Auth routes
router.post('/register', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), register);
router.post('/login', limiter.authLimiter, login);
router.post('/refresh', limiter.authLimiter, refreshToken);
router.post('/logout', authenticate, logout);
router.post('/change-password-me', authenticate, changePasswordMe);
router.post(
  '/family-heads/send-temporary-passwords',
  authenticate,
  mustResetPassword,
  authorizeRoles('ADMIN', 'VICAR'),
  sendFamilyHeadTemporaryPasswords
);
router.post('/change-password/:memberId', authenticate, changePassword);
router.post(
  '/reset-password/:memberId',
  authenticate,
  resetPassword
);

// Forgot password routes (public, strictly rate limited)
router.post('/forgot-password', limiter.sensitiveLimiter, forgotPassword);
router.post('/reset-password-with-code', limiter.sensitiveLimiter, resetPasswordWithCode);

module.exports = router;