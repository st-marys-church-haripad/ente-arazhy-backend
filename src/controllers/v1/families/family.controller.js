const Family = require('../../../models/family.model');
const Member = require('../../../models/member.model');

const isAdminOrVicar = (user) => user?.role === 'ADMIN' || user?.role === 'VICAR';

const MEMBER_FIELDS = 'firstName lastName fullName gender phone email avatarUrl spouseId familyId';

/**
 * Create a new family
 * POST /
 */
exports.createFamily = async (req, res, next) => {
  try {
    if (!isAdminOrVicar(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { churchId, divisionId, familyName, address, headMemberId } = req.body;

    const family = new Family({
      churchId,
      divisionId,
      familyName,
      address,
      headMemberId
    });

    await family.save();

    res.status(201).json({
      success: true,
      message: 'Family created successfully',
      data: family
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all families (optionally filtered by churchId/divisionId)
 * GET /
 * Query: churchId (optional), divisionId (optional), limit (default 50, max 100), skip (default 0)
 */
exports.getFamilies = async (req, res, next) => {
  try {
    const { churchId, divisionId } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = Math.max(parseInt(req.query.skip) || 0, 0);

    const filter = {};
    if (churchId) filter.churchId = churchId;
    if (divisionId) filter.divisionId = divisionId;

    const families = await Family.find(filter)
      .sort({ _id: 1 })
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate('headMemberId', 'firstName lastName fullName')
      .populate('memberIds', MEMBER_FIELDS)
      .limit(limit)
      .skip(skip)
      .lean();

    res.status(200).json({
      success: true,
      count: families.length,
      data: families
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single family by ID with populated relationships
 * GET /:id
 */
exports.getFamilyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const family = await Family.findById(id)
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate('headMemberId', 'firstName lastName fullName')
      .populate('memberIds', MEMBER_FIELDS)
      .lean();

    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      });
    }

    res.status(200).json({
      success: true,
      data: family
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all members belonging to a family
 * GET /:id/members
 */
exports.getFamilyMembers = async (req, res, next) => {
  try {
    const { id } = req.params;

    const family = await Family.findById(id)
      .populate('memberIds', MEMBER_FIELDS)
      .lean();

    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      });
    }

    const members = family?.memberIds || [];

    res.status(200).json({
      success: true,
      count: members.length,
      data: members
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update family information
 * PUT /:id
 */
exports.updateFamily = async (req, res, next) => {
  try {
    const { id } = req.params;
    const privileged = isAdminOrVicar(req.user);

    /* Admin/vicar can edit any family; a family head can edit only their own */
    const isOwnFamilyHead =
      req.user?.role === 'FAMILY_HEAD' &&
      req.user.familyId &&
      String(req.user.familyId) === String(id);

    if (!privileged && !isOwnFamilyHead) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to update this family'
      });
    }

    const { churchId, divisionId, familyName, address, headMemberId, memberIds } = req.body;

    /* Structural fields (church, division, head, member list) are admin/vicar only */
    const updateData = privileged
      ? { churchId, divisionId, familyName, address, headMemberId, memberIds }
      : { familyName, address };

    const family = await Family.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate('headMemberId', 'firstName lastName fullName')
      .populate('memberIds', MEMBER_FIELDS)
      .lean();

    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Family updated successfully',
      data: family
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a family (only if no members exist)
 * DELETE /:id
 */
exports.deleteFamily = async (req, res, next) => {
  try {
    if (!isAdminOrVicar(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;

    /* Prevent deletion of families with members */
    const hasMembers = await Member.exists({ familyId: id });
    if (hasMembers) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete family with existing members'
      });
    }

    const family = await Family.findByIdAndDelete(id);

    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Family deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};