const router = require('express').Router();
const {
  createChurch,
  getChurches,
  getChurchById,
  updateChurch,
  deleteChurch
} = require('../../controllers/v1/churches/church.controller');
const authenticate = require('../../middlewares/authenticate');
const adminOnly = require('../../middlewares/adminOnly');
const mustResetPassword = require('../../middlewares/mustResetPassword');

// Church routes
router.post('/', authenticate, mustResetPassword, adminOnly, createChurch);
router.get('/', authenticate, mustResetPassword, getChurches);
router.get('/:id', authenticate, mustResetPassword, getChurchById);
router.put('/:id', authenticate, mustResetPassword, adminOnly, updateChurch);
router.delete('/:id', authenticate, mustResetPassword, adminOnly, deleteChurch);

module.exports = router;