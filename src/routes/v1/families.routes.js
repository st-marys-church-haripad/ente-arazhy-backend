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

// Family routes
router.post('/', authenticate, createFamily);
router.get('/', authenticate, getFamilies);
router.get('/:id', authenticate, getFamilyById);
router.get('/:id/members', authenticate, getFamilyMembers);
router.put('/:id', authenticate, updateFamily);
router.delete('/:id', authenticate, deleteFamily);

module.exports = router;
