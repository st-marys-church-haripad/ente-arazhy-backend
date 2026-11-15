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
const authorizeRoles = require('../../middlewares/authorizeRoles');
const mustResetPassword = require('../../middlewares/mustResetPassword');

// Family routes (updateFamily checks "own family" inside the controller)
router.post('/', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), createFamily);
router.get('/', authenticate, mustResetPassword, getFamilies);
router.get('/:id', authenticate, mustResetPassword, getFamilyById);
router.get('/:id/members', authenticate, mustResetPassword, getFamilyMembers);
router.put('/:id', authenticate, mustResetPassword, updateFamily);
router.delete('/:id', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), deleteFamily);

module.exports = router;