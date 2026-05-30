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
router.post('/',  createMember);
router.get('/',  getMembers);
router.get('/:id',  getMemberById);
router.put('/:id',  updateMember);
router.delete('/:id',  deleteMember);
router.delete('/:id/permanent',  permanentlyDeleteMember);

module.exports = router;
