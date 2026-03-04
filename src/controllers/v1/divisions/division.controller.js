const Division = require('../../../models/division.model');

// Create a new division
exports.createDivision = async (req, res, next) => {
  try {
    const { churchId, name } = req.body;

    const division = new Division({ churchId, name });
    await division.save();

    res.status(201).json({
      success: true,
      message: 'Division created successfully',
      data: division
    });
  } catch (error) {
    next(error);
  }
};

// Get all divisions
exports.getDivisions = async (req, res, next) => {
  try {
    const { churchId } = req.query;
    const filter = churchId ? { churchId } : {};
    
    const divisions = await Division.find(filter).populate('churchId', 'name');

    res.status(200).json({
      success: true,
      count: divisions.length,
      data: divisions
    });
  } catch (error) {
    next(error);
  }
};

// Get a single division by ID
exports.getDivisionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const division = await Division.findById(id).populate('churchId', 'name');

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    res.status(200).json({
      success: true,
      data: division
    });
  } catch (error) {
    next(error);
  }
};

// Update a division
exports.updateDivision = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { churchId, name } = req.body;

    const division = await Division.findByIdAndUpdate(
      id,
      { churchId, name },
      { new: true, runValidators: true }
    ).populate('churchId', 'name');

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Division updated successfully',
      data: division
    });
  } catch (error) {
    next(error);
  }
};

// Delete a division
exports.deleteDivision = async (req, res, next) => {
  try {
    const { id } = req.params;
    const division = await Division.findByIdAndDelete(id);

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Division deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
