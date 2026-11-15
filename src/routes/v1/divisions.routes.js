const router = require('express').Router();
const {
  createDivision,
  getDivisions,
  getDivisionById,
  updateDivision,
  deleteDivision
} = require('../../controllers/v1/divisions/division.controller');
const authenticate = require('../../middlewares/authenticate');
const adminOnly = require('../../middlewares/adminOnly');
const mustResetPassword = require('../../middlewares/mustResetPassword');

// Division routes
router.post('/', authenticate, mustResetPassword, adminOnly, createDivision);
router.get('/', authenticate, mustResetPassword, getDivisions);
router.get('/:id', authenticate, mustResetPassword, getDivisionById);
router.put('/:id', authenticate, mustResetPassword, adminOnly, updateDivision);
router.delete('/:id', authenticate, mustResetPassword, adminOnly, deleteDivision);

module.exports = router;