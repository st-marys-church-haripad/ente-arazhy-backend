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
router.post('/', createDivision);
router.get('/', getDivisions);
router.get('/:id', getDivisionById);
router.put('/:id', updateDivision);
router.delete('/:id', deleteDivision);

module.exports = router;
