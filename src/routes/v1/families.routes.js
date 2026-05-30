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
router.post('/', authenticate, mustResetPassword, createFamily);
router.get('/', authenticate, mustResetPassword, getFamilies);
router.get('/:id', authenticate, mustResetPassword, getFamilyById);
router.get('/:id/members', authenticate, mustResetPassword, getFamilyMembers);
router.put('/:id', authenticate, mustResetPassword, updateFamily);
router.delete('/:id', authenticate, mustResetPassword, deleteFamily);

module.exports = router;
