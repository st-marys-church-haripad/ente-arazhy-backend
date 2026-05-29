const router = require('express').Router();
const { getEventsSummary } = require('../../controllers/v1/misc/celebrations.controller');
const authenticate = require('../../middlewares/authenticate');
const mustResetPassword = require('../../middlewares/mustResetPassword');
// Misc routes
router.get('/celebrations', authenticate, mustResetPassword, getEventsSummary);

module.exports = router;