const router = require('express').Router();
const {
	getEventsSummary,
	getBirthdays,
	getAnniversaries,
	getDeathAnniversaries
} = require('../../controllers/v1/misc/celebrations.controller');
const authenticate = require('../../middlewares/authenticate');
const mustResetPassword = require('../../middlewares/mustResetPassword');
// Misc routes
router.get('/celebrations', authenticate, mustResetPassword, getEventsSummary);
router.get('/celebrations/birthdays', authenticate, mustResetPassword, getBirthdays);
router.get('/celebrations/anniversaries', authenticate, mustResetPassword, getAnniversaries);
router.get('/celebrations/death-anniversaries', authenticate, mustResetPassword, getDeathAnniversaries);

module.exports = router;