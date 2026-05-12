const Church = require('../../../models/church.model');

/**
 * Create a new church
 * POST /
 */
exports.createChurch = async (req, res, next) => {
  try {
    const { name, address, phone, email } = req.body;

    const church = new Church({ name, address, phone, email });
    await church.save();

    res.status(201).json({
      success: true,
      message: 'Church created successfully',
      data: church
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all churches
 * GET /
 */
exports.getChurches = async (req, res, next) => {
  try {
    const churches = await Church.find();

    res.status(200).json({
      success: true,
      count: churches.length,
      data: churches
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single church by ID
 * GET /:id
 */
exports.getChurchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const church = await Church.findById(id);

    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Church not found'
      });
    }

    res.status(200).json({
      success: true,
      data: church
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update church information
 * PUT /:id
 */
exports.updateChurch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, phone, email } = req.body;

    const church = await Church.findByIdAndUpdate(
      id,
      { name, address, phone, email },
      { new: true, runValidators: true }
    );

    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Church not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Church updated successfully',
      data: church
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a church
 * DELETE /:id
 */
exports.deleteChurch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const church = await Church.findByIdAndDelete(id);

    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Church not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Church deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
