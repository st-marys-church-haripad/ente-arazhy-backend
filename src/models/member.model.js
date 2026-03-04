const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const memberSchema = new mongoose.Schema({

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

  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Family",
    required: true,
    index: true
  },

  firstName: { type: String, required: true },
  lastName: String,
  fullName: { type: String, index: true },

  houseNumber: Number,
  gender: String,
  dob: Date,
  marriageDate: Date,

  email: { type: String, sparse: true },
  phone: { type: String, sparse: true },
  age: { type: Number, default: null },

  avatarUrl: String,

  spouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    index: true
  },

  parentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    index: true
  }],

  isFamilyHead: { type: Boolean, default: false },
  isVicar: { type: Boolean, default: false },

  role: {
    type: String,
    enum: ["VICAR", "FAMILY_HEAD", "MEMBER"],
    default: "MEMBER"
  },

  password: String,
  dateOfDeath: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  mustResetPassword: { type: Boolean, default: true },

}, { timestamps: true });

memberSchema.index({ fullName: "text" });

memberSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    next();
    return;
  }
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Member", memberSchema);