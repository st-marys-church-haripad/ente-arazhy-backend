const router = require('express').Router();
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent
} = require('../../controllers/v1/events/event.controller');
const authenticate = require('../../middlewares/authenticate');
const mustResetPassword = require('../../middlewares/mustResetPassword');

// Event routes
router.post('/', authenticate, mustResetPassword, createEvent);
router.get('/', authenticate, mustResetPassword, getEvents);
router.get('/:id', authenticate, mustResetPassword, getEventById);
router.put('/:id', authenticate, mustResetPassword, updateEvent);
router.delete('/:id', authenticate, mustResetPassword, deleteEvent);

module.exports = router;
