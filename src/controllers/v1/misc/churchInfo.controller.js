const ChurchInfo = require('../../../models/churchInfo.model');
const { CHURCH_INFO, ADMINISTRATION_SECTIONS } = require('../../../constants/administrationData');

const KEY = 'main';
const isStr = (v) => typeof v === 'string';
const INFO_LIMITS = { name: 200, alsoKnownAs: 200, location: 300, website: 300 };

/* Each validator returns an error message, or null when fine */
const infoError = (info) => {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return 'info must be an object';
  for (const [field, value] of Object.entries(info)) {
    if (!(field in INFO_LIMITS)) return `info.${field} is not an allowed field`;
    if (!isStr(value) || !value.trim() || value.length > INFO_LIMITS[field]) {
      return `info.${field} must be text (maximum ${INFO_LIMITS[field]} characters)`;
    }
  }
  return null;
};

const sectionsError = (sections) => {
  if (!Array.isArray(sections) || sections.length > 20) {
    return 'sections must be an array (maximum 20 sections)';
  }
  for (const [i, section] of sections.entries()) {
    if (!section || !isStr(section.title) || !section.title.trim() || section.title.length > 100) {
      return `sections[${i}].title must be text (maximum 100 characters)`;
    }
    if (!Array.isArray(section.members) || section.members.length > 50) {
      return `sections[${i}].members must be an array (maximum 50 members)`;
    }
    for (const [j, m] of section.members.entries()) {
      const at = `sections[${i}].members[${j}]`;
      if (!m || !isStr(m.name) || !m.name.trim() || m.name.length > 100) {
        return `${at}.name must be text (maximum 100 characters)`;
      }
      if (m.role !== undefined && (!isStr(m.role) || m.role.length > 300)) {
        return `${at}.role must be text (maximum 300 characters)`;
      }
      if (m.phone !== undefined && (!isStr(m.phone) || !/^[+\d\s-]{0,20}$/.test(m.phone))) {
        return `${at}.phone must be a valid phone number`;
      }
    }
  }
  return null;
};

const cleanSections = (sections) =>
  sections.map((s) => ({
    title: s.title.trim(),
    members: s.members.map((m) => ({
      name: m.name.trim(),
      role: (m.role || '').trim(),
      phone: (m.phone || '').trim()
    }))
  }));

/* Custom data wins; otherwise the defaults */
const buildResponse = (doc) => ({
  info: { ...CHURCH_INFO, ...(doc?.info || {}) },
  sections: doc?.sections || ADMINISTRATION_SECTIONS,
  isCustom: { info: !!doc?.info, sections: !!doc?.sections }
});

/**
 * Get church info + administration sections
 * GET /church-info
 */
exports.getChurchInfo = async (req, res, next) => {
  try {
    const doc = await ChurchInfo.findOne({ key: KEY }).lean();
    res.status(200).json({ success: true, data: buildResponse(doc) });
  } catch (error) {
    next(error);
  }
};

/**
 * Update church info and/or administration sections (admin/vicar)
 * PUT /church-info
 * Body: { info?: { name, alsoKnownAs, location, website }, sections?: [...] }
 * info fields not sent keep their current value; sections is replaced as a whole.
 */
exports.updateChurchInfo = async (req, res, next) => {
  try {
    const { info, sections } = req.body;

    if (info === undefined && sections === undefined) {
      return res.status(400).json({ success: false, message: 'Send info, sections, or both' });
    }

    const problem =
      (info !== undefined && infoError(info)) ||
      (sections !== undefined && sectionsError(sections)) ||
      null;
    if (problem) return res.status(400).json({ success: false, message: problem });

    const existing = await ChurchInfo.findOne({ key: KEY }).lean();
    const $set = { updatedBy: req.userId };

    if (info !== undefined) {
      const trimmed = Object.fromEntries(Object.entries(info).map(([k, v]) => [k, v.trim()]));
      $set.info = { ...CHURCH_INFO, ...(existing?.info || {}), ...trimmed };
    }
    if (sections !== undefined) $set.sections = cleanSections(sections);

    const updated = await ChurchInfo.findOneAndUpdate(
      { key: KEY },
      { $set },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.status(200).json({
      success: true,
      message: 'Church info updated successfully',
      data: buildResponse(updated)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset to defaults (admin/vicar)
 * DELETE /church-info?part=info|sections   (no part = reset everything)
 */
exports.resetChurchInfo = async (req, res, next) => {
  try {
    const { part } = req.query;
    if (part !== undefined && !['info', 'sections'].includes(part)) {
      return res.status(400).json({ success: false, message: 'part must be info or sections' });
    }

    const doc = part
      ? await ChurchInfo.findOneAndUpdate({ key: KEY }, { $unset: { [part]: '' } }, { new: true }).lean()
      : (await ChurchInfo.deleteOne({ key: KEY }), null);

    res.status(200).json({
      success: true,
      message: 'Defaults restored',
      data: buildResponse(doc)
    });
  } catch (error) {
    next(error);
  }
};