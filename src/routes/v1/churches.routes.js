const router = require('express').Router();
const {
  createChurch,
  getChurches,
  getChurchById,
  updateChurch,
  deleteChurch
} = require('../../controllers/v1/churches/church.controller');
const authenticate = require('../../middlewares/authenticate');

// Church routes
router.post('/', authenticate, createChurch);
router.get('/', authenticate, getChurches);
router.get('/:id', authenticate, getChurchById);
router.put('/:id', authenticate, updateChurch);
router.delete('/:id', authenticate, deleteChurch);

module.exports = router;
