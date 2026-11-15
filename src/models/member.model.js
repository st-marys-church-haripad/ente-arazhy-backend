const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const memberSchema = new mongoose.Schema({

  churchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Church",
    index: true
  },

  divisionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Division",
    index: true
  },

  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Family",
    index: true
  },

  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, trim: true, maxlength: 100 },
  fullName: { type: String, index: true, trim: true, maxlength: 200 },

  houseNumber: Number,
  gender: String,
  dob: Date,
  marriageDate: Date,
  maritalStatus: String,

  email: { type: String, sparse: true, trim: true, maxlength: 254 },
  phone: { type: String, sparse: true, trim: true, maxlength: 20 },
  age: { type: Number, default: null },


  avatarUrl: String,

  bloodGroup: { type: String },
  profession: { type: String },

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
    enum: ["ADMIN", "VICAR", "FAMILY_HEAD", "MEMBER"],
    default: "MEMBER"
  },

  password: String,
  dateOfDeath: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  mustResetPassword: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, select: false },
  lockUntil: { type: Date, select: false },
  tokensValidAfter: { type: Date, select: false }
}, { timestamps: true });

// memberSchema.index({ fullName: "text", firstName: "text", lastName: "text" });

// Login lookup by house number
memberSchema.index({ houseNumber: 1 });

// Never include the password hash when a document is serialised to JSON
memberSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  }
});

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