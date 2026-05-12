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
router.post('/', createChurch);
router.get('/', getChurches);
router.get('/:id', getChurchById);
router.put('/:id', updateChurch);
router.delete('/:id', deleteChurch);

module.exports = router;
