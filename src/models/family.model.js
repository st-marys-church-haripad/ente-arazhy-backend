const mongoose = require("mongoose");

const familySchema = new mongoose.Schema({
  churchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Church",
    required: true,
    index: true
  },

  divisionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Division",
    required: true,
    index: true
  },

  familyName: {
    type: String,
    required: true,
    index: true
  },

  address: String,

  headMemberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    index: true
  }

}, { timestamps: true });

familySchema.index({ divisionId: 1, familyName: 1 });

module.exports = mongoose.model("Family", familySchema);