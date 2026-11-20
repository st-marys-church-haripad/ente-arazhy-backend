const mongoose = require('mongoose');

const churchInfoSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    info: { type: mongoose.Schema.Types.Mixed, default: undefined },
    sections: { type: mongoose.Schema.Types.Mixed, default: undefined },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChurchInfo', churchInfoSchema);