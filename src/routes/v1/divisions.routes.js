const router = require('express').Router();
const {
  createDivision,
  getDivisions,
  getDivisionById,
  updateDivision,
  deleteDivision
} = require('../../controllers/v1/divisions/division.controller');
const authenticate = require('../../middlewares/authenticate');

// Division routes
router.post('/', authenticate, createDivision);
router.get('/', authenticate, getDivisions);
router.get('/:id', authenticate, getDivisionById);
router.put('/:id', authenticate, updateDivision);
router.delete('/:id', authenticate, deleteDivision);

module.exports = router;
