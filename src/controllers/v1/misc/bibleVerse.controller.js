const BibleVerse = require('../../../models/bibleVerse.model');
const { bibleVerses } = require('../../../constants/bibleVerses');

const DEFAULTS = new Map(bibleVerses.map((verse) => [Number(verse.id), verse]));

const isStr = (value) => typeof value === 'string';

/* id must be a whole number from 1 to 31 (day of the month) */
const parseDay = (value) => {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
};

const toItem = (verse, isCustom) => ({
  id: verse.id,
  verses: verse.verses,
  from: verse.from,
  isCustom
});

/* Returns an error message, or null when the provided fields are fine */
const textError = ({ verses, from }) => {
  if (verses !== undefined && (!isStr(verses) || !verses.trim() || verses.length > 1000)) {
    return 'verses must be text (maximum 1000 characters)';
  }
  if (from !== undefined && (!isStr(from) || !from.trim() || from.length > 100)) {
    return 'from must be text (maximum 100 characters)';
  }
  return null;
};

/* Day of the month in Indian Standard Time */
const todayInIST = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCDate();

/* A custom verse wins; otherwise the default for that day */
const findVerse = async (day) => {
  const custom = await BibleVerse.findOne({ id: day }).select('id verses from').lean();
  if (custom) return toItem(custom, true);

  const fallback = DEFAULTS.get(day);
  return fallback ? toItem(fallback, false) : null;
};

const invalidDay = (res) =>
  res.status(400).json({
    success: false,
    message: 'id must be a whole number between 1 and 31 (day of the month)'
  });

/**
 * Get all 31 verses (defaults with custom ones applied)
 * GET /bible-verses
 */
exports.getBibleVerses = async (req, res, next) => {
  try {
    const custom = await BibleVerse.find().select('id verses from').lean();

    const merged = new Map(
      bibleVerses.map((verse) => [Number(verse.id), toItem(verse, false)])
    );
    custom.forEach((verse) => merged.set(verse.id, toItem(verse, true)));

    const data = [...merged.values()].sort((a, b) => a.id - b.id);

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's verse (day of the month in IST)
 * GET /bible-verses/today
 */
exports.getBibleVerseToday = async (req, res, next) => {
  try {
    const verse = await findVerse(todayInIST());

    if (!verse) {
      return res.status(404).json({ success: false, message: 'Verse not found' });
    }

    res.status(200).json({ success: true, data: verse });
  } catch (error) {
    next(error);
  }
};

/**
 * Get the verse for a day of the month
 * GET /bible-verses/:id
 */
exports.getBibleVerseById = async (req, res, next) => {
  try {
    const day = parseDay(req.params.id);
    if (!day) return invalidDay(res);

    const verse = await findVerse(day);

    if (!verse) {
      return res.status(404).json({ success: false, message: 'Verse not found' });
    }

    res.status(200).json({ success: true, data: verse });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a custom verse for a day (admin/vicar)
 * POST /bible-verses
 * Body: { id, verses, from }
 */
exports.createBibleVerse = async (req, res, next) => {
  try {
    const { id, verses, from } = req.body;

    const day = parseDay(id);
    if (!day) return invalidDay(res);

    if (verses === undefined || from === undefined) {
      return res.status(400).json({
        success: false,
        message: 'id, verses and from are required'
      });
    }

    const problem = textError({ verses, from });
    if (problem) {
      return res.status(400).json({ success: false, message: problem });
    }

    if (await BibleVerse.exists({ id: day })) {
      return res.status(409).json({
        success: false,
        message: 'This day already has a custom verse. Use PUT to edit it.'
      });
    }

    const created = await BibleVerse.create({
      id: day,
      verses: verses.trim(),
      from: from.trim(),
      updatedBy: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Verse created successfully',
      data: toItem(created, true)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Edit the verse for a day (admin/vicar). Works for default verses too.
 * PUT /bible-verses/:id
 * Body: { verses, from } (send one or both)
 */
exports.updateBibleVerse = async (req, res, next) => {
  try {
    const day = parseDay(req.params.id);
    if (!day) return invalidDay(res);

    const { verses, from } = req.body;

    if (verses === undefined && from === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Send verses, from, or both'
      });
    }

    const problem = textError({ verses, from });
    if (problem) {
      return res.status(400).json({ success: false, message: problem });
    }

    /* Fields that are not sent keep their current value (custom or default) */
    const current = await findVerse(day);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Verse not found' });
    }

    const updated = await BibleVerse.findOneAndUpdate(
      { id: day },
      {
        $set: {
          verses: verses !== undefined ? verses.trim() : current.verses,
          from: from !== undefined ? from.trim() : current.from,
          updatedBy: req.userId
        }
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Verse updated successfully',
      data: toItem(updated, true)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove the custom verse so the default comes back (admin/vicar)
 * DELETE /bible-verses/:id
 */
exports.deleteBibleVerse = async (req, res, next) => {
  try {
    const day = parseDay(req.params.id);
    if (!day) return invalidDay(res);

    const result = await BibleVerse.deleteOne({ id: day });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'This day has no custom verse'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Custom verse removed. The default verse is back.',
      data: await findVerse(day)
    });
  } catch (error) {
    next(error);
  }
};