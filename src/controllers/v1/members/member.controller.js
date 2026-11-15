const Member = require('../../../models/member.model');
const Family = require('../../../models/family.model');
const Token = require('../../../models/token.model');

/* ========== Helpers ========== */

const isStr = (value) => typeof value === 'string';
const isAdminOrVicar = (user) => user?.role === 'ADMIN' || user?.role === 'VICAR';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Fields anyone allowed to edit a member may change */
const BASIC_FIELDS = [
  'firstName', 'lastName', 'gender', 'dob', 'marriageDate', 'maritalStatus',
  'email', 'phone', 'avatarUrl', 'spouseId', 'bloodGroup', 'profession', 'age'
];

/* Fields only admin/vicar may change */
const PRIVILEGED_FIELDS = [
  'churchId', 'divisionId', 'familyId', 'houseNumber', 'isFamilyHead',
  'isVicar', 'role', 'isActive', 'mustResetPassword', 'dateOfDeath'
];

const pickFields = (source, allowed) => {
  const picked = {};
  if (!source || typeof source !== 'object') return picked;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key)) picked[key] = source[key];
  }
  return picked;
};

/**
 * Who may modify a member:
 * admin/vicar -> anyone (only an admin may touch an admin)
 * family head -> members of their own family
 * member      -> themselves
 */
const canManageMember = (user, target) => {
  if (!user || !target) return false;
  const isSelf = String(user.id) === String(target._id);
  if (target.role === 'ADMIN' && user.role !== 'ADMIN' && !isSelf) return false;
  if (isAdminOrVicar(user) || isSelf) return true;
  return (
    user.role === 'FAMILY_HEAD' &&
    Boolean(user.familyId) &&
    Boolean(target.familyId) &&
    String(user.familyId) === String(target.familyId)
  );
};

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

const familyPopulate = {
  path: 'familyId',
  select: 'familyName address headMemberId memberIds',
  populate: [
    { path: 'headMemberId', select: 'firstName lastName fullName' },
    { path: 'memberIds', model: 'Member', select: 'firstName lastName fullName gender phone email avatarUrl spouseId bloodGroup profession' }
  ]
};

/* Remove the member's own entry from their family list (new object, shared data is not mutated) */
const withoutSelfInFamily = (member) => {
  if (member.familyId && typeof member.familyId === 'object') {
    const family = { ...member.familyId };
    if (Array.isArray(family.memberIds) && family.memberIds.length > 0) {
      family.memberIds = family.memberIds.filter((fm) => String(fm._id) !== String(member._id));
    }
    member.familyId = family;
  }
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
      dateOfDeath,
      bloodGroup,
      profession
    } = req.body;

    const privileged = isAdminOrVicar(req.user);

    /* Admin/vicar can add anywhere; a family head can only add to their own family */
    const isOwnFamilyHead =
      req.user?.role === 'FAMILY_HEAD' &&
      familyId &&
      String(req.user.familyId) === String(familyId);

    if (!privileged && !isOwnFamilyHead) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to add members'
      });
    }

    if ((email != null && !isStr(email)) || (password != null && !isStr(password))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password format'
      });
    }

    if (privileged && isStr(role) && role.toUpperCase() === 'ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only an admin can create an admin account'
      });
    }

    const hasIsActive = privileged && isActive !== undefined;
    const normalizedIsActive =
      typeof isActive === 'string' ? isActive.toLowerCase() === 'true' : Boolean(isActive);
    const normalizedDateOfDeath = dateOfDeath || null;
    const normalizedEmail = isStr(email) ? email.trim().toLowerCase() : email;

    let spouse = null;
    if (spouseId) {
      spouse = await Member.findById(spouseId).select('_id spouseId familyId');
      if (!spouse) {
        return res.status(400).json({
          success: false,
          message: 'Invalid spouseId: spouse member not found'
        });
      }
      if (!privileged && String(spouse.familyId) !== String(familyId)) {
        return res.status(403).json({
          success: false,
          message: 'Spouse must belong to the same family'
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
      email: normalizedEmail,
      phone,
      avatarUrl,
      spouseId,
      isFamilyHead: privileged ? isFamilyHead : undefined,
      isVicar: privileged ? isVicar : undefined,
      role: privileged ? role : undefined,
      password: privileged ? password : undefined,
      isActive: hasIsActive ? normalizedIsActive : !normalizedDateOfDeath,
      dateOfDeath: normalizedDateOfDeath,
      bloodGroup,
      profession
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
    // Support both 'skip' and 'offset' as aliases
    let skip = 0;
    if (req.query.offset !== undefined) {
      skip = Math.max(parseInt(req.query.offset) || 0, 0);
    } else {
      skip = Math.max(parseInt(req.query.skip) || 0, 0);
    }

    const filter = {};
    if (churchId) filter.churchId = churchId;
    if (divisionId) filter.divisionId = divisionId;
    if (familyId) filter.familyId = familyId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (search) {
      const searchText = String(Array.isArray(search) ? search[0] : search).trim().slice(0, 100);

      if (searchText) {
        /* Escape user input so it cannot be used as a regular-expression attack */
        const regex = new RegExp(escapeRegex(searchText), 'i');

        // Find families whose address matches the search
        const families = await Family.find({ address: regex }).select('_id').lean();

        const orConditions = [
          { fullName: regex },
          { firstName: regex },
          { lastName: regex }
        ];
        if (families.length > 0) {
          orConditions.push({ familyId: { $in: families.map((fam) => fam._id) } });
        }
        filter.$or = orConditions;
      }
    }

    // Count and page run at the same time
    const [count, members] = await Promise.all([
      Member.countDocuments(filter),
      Member.find(filter)
        .sort({ _id: 1 }) // Ascending order, oldest first
        .skip(skip)
        .limit(limit)
        .select('-password -parentIds')
        .populate('churchId', 'name')
        .populate('divisionId', 'name')
        .populate(familyPopulate)
        .lean()
    ]);

    for (const member of members) {
      // Remove spouseId from response
      delete member.spouseId;
      withoutSelfInFamily(member);
    }

    res.status(200).json({
      success: true,
      count, // total number of matching members (before pagination)
      pageCount: members.length, // number of members in this page
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
      .populate(familyPopulate)
      .lean();

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Remove spouseId from response
    delete member.spouseId;
    withoutSelfInFamily(member);

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
    const memberBeforeUpdate = await Member.findById(id).select('firstName lastName spouseId familyId role');

    if (!memberBeforeUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    if (!canManageMember(req.user, memberBeforeUpdate)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to update this member'
      });
    }

    /* Only the allowed fields are taken from the request (password, parentIds etc. are never accepted) */
    const privileged = isAdminOrVicar(req.user);
    const updateData = pickFields(
      req.body,
      privileged ? [...BASIC_FIELDS, ...PRIVILEGED_FIELDS] : BASIC_FIELDS
    );

    if (
      updateData.role !== undefined &&
      String(updateData.role).toUpperCase() === 'ADMIN' &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only an admin can assign the admin role'
      });
    }

    if (updateData.email !== undefined && updateData.email !== null && !isStr(updateData.email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    if (isStr(updateData.email)) {
      updateData.email = updateData.email.trim().toLowerCase();
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

      spouseForUpdate = await Member.findById(updateData.spouseId).select('_id spouseId familyId');
      if (!spouseForUpdate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid spouseId: spouse member not found'
        });
      }

      if (!privileged && String(spouseForUpdate.familyId) !== String(memberBeforeUpdate.familyId)) {
        return res.status(403).json({
          success: false,
          message: 'Spouse must belong to the same family'
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
          { path: 'memberIds', select: 'firstName lastName fullName gender phone email avatarUrl spouseId bloodGroup profession' }
        ]
      })
      .populate('spouseId', 'firstName lastName fullName');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

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
    if (!isAdminOrVicar(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;

    /* A vicar cannot deactivate an admin */
    const filter = { _id: id };
    if (req.user.role !== 'ADMIN') filter.role = { $ne: 'ADMIN' };

    const member = await Member.findOneAndUpdate(
      filter,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    /* End all of their sessions */
    await Token.deleteMany({ user: member._id });

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
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;
    const member = await Member.findByIdAndDelete(id).select('-password');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    await removeMemberFromFamily(member.familyId, member._id);
    await unlinkSpouseIfLinkedToMember(member.spouseId, member._id);
    await Token.deleteMany({ user: member._id });

    res.status(200).json({
      success: true,
      message: 'Member permanently deleted',
      data: member
    });
  } catch (error) {
    next(error);
  }
};