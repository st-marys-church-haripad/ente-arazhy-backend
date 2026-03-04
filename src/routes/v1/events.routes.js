const router = require('express').Router();
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent
} = require('../../controllers/v1/events/event.controller');
const authenticate = require('../../middlewares/authenticate');

// Event routes
router.post('/', authenticate, createEvent);
router.get('/', authenticate, getEvents);
router.get('/:id', authenticate, getEventById);
router.put('/:id', authenticate, updateEvent);
router.delete('/:id', authenticate, deleteEvent);

module.exports = router;
