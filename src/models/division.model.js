const mongoose = require("mongoose");

const divisionSchema = new mongoose.Schema({
  churchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Church",
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  }
}, { timestamps: true });

divisionSchema.index({ churchId: 1, name: 1 });

module.exports = mongoose.model("Division", divisionSchema);