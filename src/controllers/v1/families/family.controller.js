const Family = require('../../../models/family.model');
const Member = require('../../../models/member.model');

// Create a new family
exports.createFamily = async (req, res, next) => {
  try {
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

// Get all families with filters
exports.getFamilies = async (req, res, next) => {
  try {
    const { churchId, divisionId } = req.query;
    
    const filter = {};
    if (churchId) filter.churchId = churchId;
    if (divisionId) filter.divisionId = divisionId;

    const families = await Family.find(filter)
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate('headMemberId', 'firstName lastName fullName');

    res.status(200).json({
      success: true,
      count: families.length,
      data: families
    });
  } catch (error) {
    next(error);
  }
};

// Get a single family by ID
exports.getFamilyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const family = await Family.findById(id)
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate('headMemberId', 'firstName lastName fullName');

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

// Get all members of a family
exports.getFamilyMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const family = await Family.findById(id);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      });
    }

    const members = await Member.find({ familyId: id })
      .select('-password')
      .populate('spouseId', 'firstName lastName fullName')
      .populate('parentIds', 'firstName lastName fullName');

    res.status(200).json({
      success: true,
      count: members.length,
      data: members
    });
  } catch (error) {
    next(error);
  }
};

// Update a family
exports.updateFamily = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { churchId, divisionId, familyName, address, headMemberId } = req.body;

    const family = await Family.findByIdAndUpdate(
      id,
      { churchId, divisionId, familyName, address, headMemberId },
      { new: true, runValidators: true }
    )
      .populate('churchId', 'name')
      .populate('divisionId', 'name')
      .populate('headMemberId', 'firstName lastName fullName');

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

// Delete a family
exports.deleteFamily = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if family has members
    const memberCount = await Member.countDocuments({ familyId: id });
    if (memberCount > 0) {
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
