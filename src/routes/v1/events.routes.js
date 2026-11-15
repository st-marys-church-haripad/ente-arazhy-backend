const router = require('express').Router();
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent
} = require('../../controllers/v1/events/event.controller');
const authenticate = require('../../middlewares/authenticate');
const authorizeRoles = require('../../middlewares/authorizeRoles');
const mustResetPassword = require('../../middlewares/mustResetPassword');

// Event routes
router.post('/', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), createEvent);
router.get('/', authenticate, mustResetPassword, getEvents);
router.get('/:id', authenticate, mustResetPassword, getEventById);
router.put('/:id', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), updateEvent);
router.delete('/:id', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), deleteEvent);

module.exports = router;