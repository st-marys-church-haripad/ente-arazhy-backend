const router = require('express').Router();
const { getEventsSummary } = require('../../controllers/v1/misc/celebrations.controller');
const authenticate = require('../../middlewares/authenticate');
// Misc routes
router.get('/celebrations', authenticate, getEventsSummary);

module.exports = router;