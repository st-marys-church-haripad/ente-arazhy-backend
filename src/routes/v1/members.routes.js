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
const mustResetPassword = require('../../middlewares/mustResetPassword');

// Member routes
router.post('/', authenticate, mustResetPassword, createMember);
router.get('/', authenticate, mustResetPassword, getMembers);
router.get('/:id', authenticate, mustResetPassword, getMemberById);
router.put('/:id', authenticate, mustResetPassword, updateMember);
router.delete('/:id', authenticate, mustResetPassword, deleteMember);
router.delete('/:id/permanent', authenticate, mustResetPassword, permanentlyDeleteMember);

module.exports = router;
