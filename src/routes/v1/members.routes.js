const router = require('express').Router();
const {
  createMember,
  getMembers,
  getMemberById,
  updateMember,
  deleteMember,
  permanentlyDeleteMember
} = require('../../controllers/v1/members/member.controller');
const authenticate = require('../../middlewares/authenticate');
const adminOnly = require('../../middlewares/adminOnly');
const authorizeRoles = require('../../middlewares/authorizeRoles');
const mustResetPassword = require('../../middlewares/mustResetPassword');

// Member routes (createMember and updateMember check family/self scope inside the controller)
router.post('/', authenticate, mustResetPassword, createMember);
router.get('/', authenticate, mustResetPassword, getMembers);
router.get('/:id', authenticate, mustResetPassword, getMemberById);
router.put('/:id', authenticate, mustResetPassword, updateMember);
router.delete('/:id', authenticate, mustResetPassword, authorizeRoles('ADMIN', 'VICAR'), deleteMember);
router.delete('/:id/permanent', authenticate, mustResetPassword, adminOnly, permanentlyDeleteMember);

module.exports = router;