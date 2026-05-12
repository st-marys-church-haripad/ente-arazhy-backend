const Member = require('../../../models/member.model');

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
      parentIds,
      isFamilyHead,
      isVicar,
      role,
      password
    } = req.body;

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
      parentIds,
      isFamilyHead,
      isVicar,
      role,
      password
    });

    await member.save();

    /* Exclude password from response */
    const memberObj = member.toObject();
    delete memberObj.password;

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
 * Query: churchId, divisionId, familyId, isActive, search
 */
exports.getMembers = async (req, res, next) => {
  try {
    const { churchId, divisionId, familyId, isActive, search } = req.query;
    
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
      .select('-password')
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate('familyId', 'familyName address')
      .populate({
        path: 'spouseId',
        select: 'firstName lastName fullName gender phone email avatarUrl parentIds',
        populate: {
          path: 'parentIds',
          select: 'firstName lastName fullName gender phone email avatarUrl'
        }
      })
      .populate('parentIds', 'firstName lastName fullName');

    /* Enrich each member with family tree relationships */
    const enrichedMembers = await Promise.all(members.map(async (member) => {
      const memberData = member.toObject();

      /* Get children (members with this member as parent) */
      const children = await Member.find({ parentIds: member._id })
        .select('-password')
        .populate({
          path: 'spouseId',
          select: 'firstName lastName fullName gender phone email avatarUrl parentIds',
          populate: {
            path: 'parentIds',
            select: 'firstName lastName fullName gender phone email avatarUrl'
          }
        });

      /* Get grandchildren (descendants of children) */
      const childrenIds = children.map(child => child._id);
      const grandchildren = childrenIds.length > 0 
        ? await Member.find({ parentIds: { $in: childrenIds } })
            .select('-password')
            .populate({
              path: 'spouseId',
              select: 'firstName lastName fullName gender phone email avatarUrl parentIds',
              populate: {
                path: 'parentIds',
                select: 'firstName lastName fullName gender phone email avatarUrl'
              }
            })
            .populate('parentIds', 'firstName lastName fullName')
        : [];

      /* Get grandparents (ancestors up two generations) */
      const parentIds = member.parentIds?.map(parent => parent._id) || [];
      const grandparents = parentIds.length > 0
        ? await Member.find({ 
            _id: { $in: parentIds } 
          })
            .select('-password')
            .populate('parentIds', 'firstName lastName fullName gender phone email avatarUrl')
        : [];

      /* Extract parents' parents (great-grandparents in relation) */
      const grandparentsList = [];
      for (const parent of grandparents) {
        if (parent.parentIds && parent.parentIds.length > 0) {
          const gps = await Member.find({ 
            _id: { $in: parent.parentIds.map(p => p._id) } 
          }).select('-password');
          grandparentsList.push(...gps);
        }
      }

      memberData.children = children;
      memberData.grandchildren = grandchildren;
      memberData.grandparents = grandparentsList;

      return memberData;
    }));

    res.status(200).json({
      success: true,
      count: enrichedMembers.length,
      data: enrichedMembers
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
      .select('-password')
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate('familyId', 'familyName address')
      .populate({
        path: 'spouseId',
        select: 'firstName lastName fullName gender phone email avatarUrl parentIds',
        populate: {
          path: 'parentIds',
          select: 'firstName lastName fullName gender phone email avatarUrl'
        }
      })
      .populate('parentIds', 'firstName lastName fullName');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    /* Get children relationships */
    const children = await Member.find({ parentIds: id })
      .select('-password')
      .populate({
        path: 'spouseId',
        select: 'firstName lastName fullName gender phone email avatarUrl parentIds',
        populate: {
          path: 'parentIds',
          select: 'firstName lastName fullName gender phone email avatarUrl'
        }
      });

    /* Get grandchildren relationships */
    const childrenIds = children.map(child => child._id);
    const grandchildren = await Member.find({ parentIds: { $in: childrenIds } })
      .select('-password')
      .populate({
        path: 'spouseId',
        select: 'firstName lastName fullName gender phone email avatarUrl parentIds',
        populate: {
          path: 'parentIds',
          select: 'firstName lastName fullName gender phone email avatarUrl'
        }
      })
      .populate('parentIds', 'firstName lastName fullName');

    /* Get grandparents relationships */
    const parentIds = member.parentIds?.map(parent => parent._id) || [];
    const grandparents = await Member.find({ 
      _id: { $in: parentIds } 
    })
      .select('-password')
      .populate('parentIds', 'firstName lastName fullName gender phone email avatarUrl');

    /* Extract great-grandparents from grandparents' parents */
    const grandparentsList = [];
    for (const parent of grandparents) {
      if (parent.parentIds && parent.parentIds.length > 0) {
        const gps = await Member.find({ 
          _id: { $in: parent.parentIds.map(p => p._id) } 
        }).select('-password');
        grandparentsList.push(...gps);
      }
    }

    const memberData = member.toObject();
    memberData.children = children;
    memberData.grandchildren = grandchildren;
    memberData.grandparents = grandparentsList;

    res.status(200).json({
      success: true,
      data: memberData
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

    /* Recalculate fullName if name fields changed */
    if (updateData.firstName || updateData.lastName) {
      const member = await Member.findById(id);
      const firstName = updateData.firstName || member.firstName;
      const lastName = updateData.lastName || member.lastName;
      updateData.fullName = lastName ? `${firstName} ${lastName}` : firstName;
    }

    /* Prevent password modification via this endpoint */
    delete updateData.password;

    const member = await Member.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate('familyId', 'familyName address')
      .populate('spouseId', 'firstName lastName fullName')
      .populate('parentIds', 'firstName lastName fullName');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
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

    res.status(200).json({
      success: true,
      message: 'Member permanently deleted'
    });
  } catch (error) {
    next(error);
  }
};
