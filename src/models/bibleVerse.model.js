const mongoose = require('mongoose');

const bibleVerseSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, min: 1, max: 31 }, // day of the month
    verses: { type: String, required: true, trim: true, maxlength: 1000 },
    from: { type: String, required: true, trim: true, maxlength: 100 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' }
  },
  { timestamps: true, id: false }
);

module.exports = mongoose.model('BibleVerse', bibleVerseSchema);