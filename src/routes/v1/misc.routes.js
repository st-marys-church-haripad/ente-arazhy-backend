const router = require('express').Router();
const {
	getEventsSummary,
	getBirthdays,
	getAnniversaries,
	getDeathAnniversaries,
	getCelebrationCounts
} = require('../../controllers/v1/misc/celebrations.controller');
const {
	getChurchInfo,
	updateChurchInfo,
	resetChurchInfo
} = require('../../controllers/v1/misc/churchInfo.controller');
const {
	getBibleVerses,
	getBibleVerseToday,
	getBibleVerseById,
	createBibleVerse,
	updateBibleVerse,
	deleteBibleVerse
} = require('../../controllers/v1/misc/bibleVerse.controller');
const authorizeRoles = require('../../middlewares/authorizeRoles');
const authenticate = require('../../middlewares/authenticate');
const mustResetPassword = require('../../middlewares/mustResetPassword');
// Misc routes
router.get('/celebrations', authenticate, mustResetPassword, getEventsSummary);
router.get('/celebrations/birthdays', authenticate, mustResetPassword, getBirthdays);
router.get('/celebrations/anniversaries', authenticate, mustResetPassword, getAnniversaries);
router.get('/celebrations/death-anniversaries', authenticate, mustResetPassword, getDeathAnniversaries);
router.get('/celebrations/count', authenticate, mustResetPassword, getCelebrationCounts);

// Bible verses (everyone can view, only admin/vicar can change)
router.get('/bible-verses', authenticate, mustResetPassword, getBibleVerses);
router.get('/bible-verses/today', authenticate, mustResetPassword, getBibleVerseToday);
router.get('/bible-verses/:id', authenticate, mustResetPassword, getBibleVerseById);
router.post('/bible-verses', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), createBibleVerse);
router.put('/bible-verses/:id', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), updateBibleVerse);
router.delete('/bible-verses/:id', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), deleteBibleVerse);

// Church info (everyone can view, only admin/vicar can change)
router.get('/church-info', authenticate, mustResetPassword, getChurchInfo);
router.put('/church-info', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), updateChurchInfo);
router.delete('/church-info', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), resetChurchInfo);

module.exports = router;