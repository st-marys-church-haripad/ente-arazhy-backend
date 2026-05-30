const router = require('express').Router();
const {
  createFamily,
  getFamilies,
  getFamilyById,
  getFamilyMembers,
  updateFamily,
  deleteFamily
} = require('../../controllers/v1/families/family.controller');
const authenticate = require('../../middlewares/authenticate');
const mustResetPassword = require('../../middlewares/mustResetPassword');

// Family routes
router.post('/', createFamily);
router.get('/', getFamilies);
router.get('/:id', getFamilyById);
router.get('/:id/members', getFamilyMembers);
router.put('/:id', updateFamily);
router.delete('/:id', deleteFamily);

module.exports = router;
