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

// Member routes
router.post('/', authenticate, createMember);
router.get('/', authenticate, getMembers);
router.get('/:id', authenticate, getMemberById);
router.put('/:id', authenticate, updateMember);
router.delete('/:id', authenticate, deleteMember);
router.delete('/:id/permanent', authenticate, permanentlyDeleteMember);

module.exports = router;
