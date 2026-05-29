const Member = require('../../../models/member.model');
const Family = require('../../../models/family.model');

/* ========== Helper Functions ========== */

/**
 * Check if a member is active
 */
const isActiveMember = (m) => m && m.isActive === true;

/**
 * Get start and end dates for the current week (Monday-Sunday)
 */
const getWeekRange = (today = new Date()) => {
  const day = today.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(today.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Extract month and day from a date
 */
const toMonthDay = (d) => ({ month: d.getMonth(), day: d.getDate() });

/**
 * Check if a date matches today (ignoring year)
 */
const isTodayMatch = (dateValue, today) => {
  if (!dateValue) return false;
  const a = toMonthDay(new Date(dateValue));
  const b = toMonthDay(today);
  return a.month === b.month && a.day === b.day;
};

/**
 * Check if an annual date falls within a given week
 * (Handles year boundary crossing for recurring events)
 */
const isInWeek = (dateValue, weekStart, weekEnd, today) => {
  if (!dateValue) return false;

  const monthDay = toMonthDay(new Date(dateValue));
  const year = today.getFullYear();

  /* Check event date in current year */
  const eventDate = new Date(year, monthDay.month, monthDay.day);
  eventDate.setHours(12, 0, 0, 0);

  /* Also check next year's date in case week crosses year boundary */
  const eventDateNextYear = new Date(year + 1, monthDay.month, monthDay.day);
  eventDateNextYear.setHours(12, 0, 0, 0);

  return (
    (eventDate >= weekStart && eventDate <= weekEnd) ||
    (eventDateNextYear >= weekStart && eventDateNextYear <= weekEnd)
  );
};

/**
 * Calculate years since marriage date
 */
const calcAnniversaryYears = (marriageDate, today) => {
  if (!marriageDate) return null;
  const m = new Date(marriageDate);
  let years = today.getFullYear() - m.getFullYear();

  /* Adjust if anniversary hasn't occurred yet this year */
  const annivThisYear = new Date(today.getFullYear(), m.getMonth(), m.getDate());
  if (today < annivThisYear) years -= 1;

  return years < 0 ? 0 : years;
};

/**
 * Calculate years since a date (used for death anniversaries)
 */
const calcYearsSinceDate = (dateValue, today) => {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  let years = today.getFullYear() - d.getFullYear();

  const thisYearDate = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (today < thisYearDate) years -= 1;

  return years < 0 ? 0 : years;
};

/* ========== Controller ========== */

/**
 * Get upcoming celebrations summary
 * GET /events-summary
 * Returns: birthdays, anniversaries, death anniversaries for today and this week
 */
exports.getEventsSummary = async (req, res, next) => {
  try {
    const today = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(today);

    // Fetch all members with familyId
    const members = await Member.find({})
      .select('firstName lastName fullName dob marriageDate dateOfDeath isActive spouseId familyId')
      .lean();

    // Collect all familyIds
    const familyIds = Array.from(new Set(members.map(m => m.familyId).filter(Boolean)));
    const families = await Family.find({ _id: { $in: familyIds } })
      .select('_id familyName')
      .lean();
    const familyById = new Map(families.map(f => [String(f._id), f.familyName]));

    const memberById = new Map(members.map((member) => [String(member._id), member]));

    // Helper to get member basic info
    const getMemberBasic = (m) => ({
      _id: m._id,
      firstName: m.firstName,
      lastName: m.lastName,
      fullName: m.fullName,
      familyName: familyById.get(String(m.familyId)) || null
    });

    // Containers for event categories
    const birthdayToday = [];
    const birthdayWeek = [];
    const anniversaryToday = [];
    const anniversaryWeek = [];
    const deathToday = [];
    const deathWeek = [];
    const processedAnniversaryPairs = new Set();

    // Categorize events
    for (const m of members) {
      // Birthdays (only for active members)
      if (isActiveMember(m) && m.dob) {
        const isToday = isTodayMatch(m.dob, today);
        const years = calcYearsSinceDate(m.dob, today);
        const item = { member: getMemberBasic(m), years };
        if (isToday) birthdayToday.push(item);
        if (!isToday && isInWeek(m.dob, weekStart, weekEnd, today)) birthdayWeek.push(item);
      }

      // Anniversaries (both spouses must be active)
      if (m.marriageDate && m.spouseId && isActiveMember(m)) {
        const spouse = memberById.get(String(m.spouseId));
        if (!isActiveMember(spouse)) continue;

        const memberId = String(m._id);
        const spouseId = String(spouse._id);
        const pairKey = [memberId, spouseId].sort().join(':');
        if (processedAnniversaryPairs.has(pairKey)) continue;
        processedAnniversaryPairs.add(pairKey);

        const years = calcAnniversaryYears(m.marriageDate, today);
        const annivItem = {
          member: getMemberBasic(m),
          spouse: getMemberBasic(spouse),
          years
        };
        const isToday = isTodayMatch(m.marriageDate, today);
        if (isToday) anniversaryToday.push(annivItem);
        if (!isToday && isInWeek(m.marriageDate, weekStart, weekEnd, today)) anniversaryWeek.push(annivItem);
      }

      // Death anniversaries (only for inactive members)
      if (m.dateOfDeath && m.isActive === false) {
        const isToday = isTodayMatch(m.dateOfDeath, today);
        const years = calcYearsSinceDate(m.dateOfDeath, today);
        const item = { member: getMemberBasic(m), years };
        if (isToday) deathToday.push(item);
        if (!isToday && isInWeek(m.dateOfDeath, weekStart, weekEnd, today)) deathWeek.push(item);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        birthdays: { today: birthdayToday, thisWeek: birthdayWeek },
        anniversaries: { today: anniversaryToday, thisWeek: anniversaryWeek },
        deathAnniversaries: { today: deathToday, thisWeek: deathWeek }
      }
    });
  } catch (error) {
    next(error);
  }
};