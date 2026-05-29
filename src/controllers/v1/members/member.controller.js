const Member = require('../../../models/member.model');
const Family = require('../../../models/family.model');

const unlinkSpouseIfLinkedToMember = async (spouseId, memberId) => {
  if (!spouseId) return;

  await Member.updateOne(
    { _id: spouseId, spouseId: memberId },
    { $unset: { spouseId: 1 } }
  );
};

const addMemberToFamily = async (familyId, memberId) => {
  if (!familyId || !memberId) return;

  await Family.findByIdAndUpdate(familyId, {
    $addToSet: { memberIds: memberId }
  });
};

const removeMemberFromFamily = async (familyId, memberId) => {
  if (!familyId || !memberId) return;

  await Family.findByIdAndUpdate(familyId, {
    $pull: { memberIds: memberId }
  });
};

/**
 * Create a new member
 * POST /
 */
exports.createMember = async (req, res, next) => {
  try {
    const {
      churchId,
      divisionId,
      familyId,
      firstName,
      lastName,
      houseNumber,
      gender,
      dob,
      marriageDate,
      email,
      phone,
      avatarUrl,
      spouseId,
      isFamilyHead,
      isVicar,
      role,
      password,
      isActive,
      dateOfDeath
    } = req.body;

    const hasIsActive = isActive !== undefined;
    const normalizedIsActive =
      typeof isActive === 'string' ? isActive.toLowerCase() === 'true' : Boolean(isActive);
    const normalizedDateOfDeath = dateOfDeath || null;

    let spouse = null;
    if (spouseId) {
      spouse = await Member.findById(spouseId).select('_id spouseId');
      if (!spouse) {
        return res.status(400).json({
          success: false,
          message: 'Invalid spouseId: spouse member not found'
        });
      }
    }

    if (familyId) {
      const family = await Family.findById(familyId).select('_id');
      if (!family) {
        return res.status(400).json({
          success: false,
          message: 'Invalid familyId: family not found'
        });
      }
    }

    /* Construct full name */
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    const member = new Member({
      churchId,
      divisionId,
      familyId,
      firstName,
      lastName,
      fullName,
      houseNumber,
      gender,
      dob,
      marriageDate,
      email,
      phone,
      avatarUrl,
      spouseId,
      isFamilyHead,
      isVicar,
      role,
      password,
      isActive: hasIsActive ? normalizedIsActive : !normalizedDateOfDeath,
      dateOfDeath: normalizedDateOfDeath
    });

    await member.save();

    await addMemberToFamily(member.familyId, member._id);

    if (spouse) {
      if (spouse.spouseId && spouse.spouseId.toString() !== member._id.toString()) {
        await unlinkSpouseIfLinkedToMember(spouse.spouseId, spouse._id);
      }

      await Member.findByIdAndUpdate(spouse._id, { spouseId: member._id });
    }

    /* Exclude password from response */
    const memberObj = member.toObject();
    delete memberObj.password;
    delete memberObj.parentIds;

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      data: memberObj
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all members with optional filters and enriched family relationships
 * GET /
 * Query: churchId, divisionId, familyId, isActive, search, limit (default 50, max 100), skip (default 0)
 */
exports.getMembers = async (req, res, next) => {
  try {
    const { churchId, divisionId, familyId, isActive, search } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = Math.max(parseInt(req.query.skip) || 0, 0);
    
    const filter = {};
    if (churchId) filter.churchId = churchId;
    if (divisionId) filter.divisionId = divisionId;
    if (familyId) filter.familyId = familyId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    /* Full-text search across member fields */
    if (search) {
      filter.$text = { $search: search };
    }

    const members = await Member.find(filter)
      .limit(limit)
      .skip(skip)
      .select('-password -parentIds')
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate({
        path: 'familyId',
        select: 'familyName address headMemberId memberIds',
        populate: [
          { path: 'headMemberId', select: 'firstName lastName fullName' },
          { path: 'memberIds', model: 'Member', select: 'firstName lastName fullName gender phone email avatarUrl spouseId' }
        ]
      })
      .lean();

    for (const member of members) {
      // Remove spouseId from response
      delete member.spouseId;
      // Deep clone familyId to avoid mutating shared references
      if (member.familyId && typeof member.familyId === 'object') {
        member.familyId = JSON.parse(JSON.stringify(member.familyId));
        if (Array.isArray(member.familyId.memberIds) && member.familyId.memberIds.length > 0) {
          member.familyId.memberIds = member.familyId.memberIds.filter(fm => String(fm._id) !== String(member._id));
        }
      }
    }

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
 * Get a single member by ID with enriched family relationships
 * GET /:id
 */
exports.getMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const member = await Member.findById(id)
      .select('-password -parentIds')
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate({
        path: 'familyId',
        select: 'familyName address headMemberId memberIds',
        populate: [
          { path: 'headMemberId', select: 'firstName lastName fullName' },
          { path: 'memberIds', model: 'Member', select: 'firstName lastName fullName gender phone email avatarUrl spouseId' }
        ]
      })
      .lean();

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Remove spouseId from response
    delete member.spouseId;
    // Deep clone familyId to avoid mutating shared references
    if (member.familyId && typeof member.familyId === 'object') {
      member.familyId = JSON.parse(JSON.stringify(member.familyId));
      if (Array.isArray(member.familyId.memberIds) && member.familyId.memberIds.length > 0) {
        member.familyId.memberIds = member.familyId.memberIds.filter(fm => String(fm._id) !== String(member._id));
      }
    }

    res.status(200).json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update member information
 * PUT /:id
 */
exports.updateMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const memberBeforeUpdate = await Member.findById(id).select('firstName lastName spouseId familyId');

    if (!memberBeforeUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const hasSpouseIdInPayload = Object.prototype.hasOwnProperty.call(updateData, 'spouseId');
    const hasFamilyIdInPayload = Object.prototype.hasOwnProperty.call(updateData, 'familyId');

    if (hasSpouseIdInPayload && updateData.spouseId === '') {
      updateData.spouseId = null;
    }

    if (hasFamilyIdInPayload && updateData.familyId === '') {
      updateData.familyId = null;
    }

    let spouseForUpdate = null;
    if (hasSpouseIdInPayload && updateData.spouseId) {
      if (updateData.spouseId.toString() === id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'A member cannot be spouse of themselves'
        });
      }

      spouseForUpdate = await Member.findById(updateData.spouseId).select('_id spouseId');
      if (!spouseForUpdate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid spouseId: spouse member not found'
        });
      }
    }

    if (hasFamilyIdInPayload && updateData.familyId) {
      const family = await Family.findById(updateData.familyId).select('_id');
      if (!family) {
        return res.status(400).json({
          success: false,
          message: 'Invalid familyId: family not found'
        });
      }
    }

    /* Recalculate fullName if name fields changed */
    if (updateData.firstName || updateData.lastName) {
      const firstName = updateData.firstName || memberBeforeUpdate.firstName;
      const lastName = updateData.lastName || memberBeforeUpdate.lastName;
      updateData.fullName = lastName ? `${firstName} ${lastName}` : firstName;
    }

    /* Prevent password modification via this endpoint */
    delete updateData.password;
    delete updateData.parentIds;

    const member = await Member.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .select('-password -parentIds')
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate({
        path: 'familyId',
        select: 'familyName address headMemberId memberIds',
        populate: [
          { path: 'headMemberId', select: 'firstName lastName fullName' },
          { path: 'memberIds', select: 'firstName lastName fullName gender phone email avatarUrl spouseId' }
        ]
      })
      .populate('spouseId', 'firstName lastName fullName');

    if (hasFamilyIdInPayload) {
      const oldFamilyId = memberBeforeUpdate.familyId;
      const newFamilyId = updateData.familyId || null;

      if (oldFamilyId && (!newFamilyId || oldFamilyId.toString() !== newFamilyId.toString())) {
        await removeMemberFromFamily(oldFamilyId, member._id);
      }

      if (newFamilyId && (!oldFamilyId || oldFamilyId.toString() !== newFamilyId.toString())) {
        await addMemberToFamily(newFamilyId, member._id);
      }
    }

    if (hasSpouseIdInPayload) {
      const oldSpouseId = memberBeforeUpdate.spouseId;
      const newSpouseId = updateData.spouseId || null;

      if (oldSpouseId && (!newSpouseId || oldSpouseId.toString() !== newSpouseId.toString())) {
        await unlinkSpouseIfLinkedToMember(oldSpouseId, member._id);
      }

      if (spouseForUpdate) {
        if (spouseForUpdate.spouseId && spouseForUpdate.spouseId.toString() !== member._id.toString()) {
          await unlinkSpouseIfLinkedToMember(spouseForUpdate.spouseId, spouseForUpdate._id);
        }

        await Member.findByIdAndUpdate(spouseForUpdate._id, { spouseId: member._id });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate a member (soft delete)
 * DELETE /:id
 */
exports.deleteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const member = await Member.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Member deactivated successfully',
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Permanently delete a member record
 * DELETE /:id/permanent
 */
exports.permanentlyDeleteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const member = await Member.findByIdAndDelete(id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    await removeMemberFromFamily(member.familyId, member._id);
    await unlinkSpouseIfLinkedToMember(member.spouseId, member._id);

    res.status(200).json({
      success: true,
      message: 'Member permanently deleted'
    });
  } catch (error) {
    next(error);
  }
};
