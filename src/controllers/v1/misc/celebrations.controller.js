const Member = require('../../../models/member.model');

/* ========== Helper Functions ========== */

/**
 * Check if a member is alive (active and not deceased)
 */
const isAlive = (m) => m && m.isActive === true && !m.dateOfDeath;

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

    /* Load members with minimal fields for event checks */
    const members = await Member.find({})
      .select('firstName lastName fullName dob marriageDate dateOfDeath isActive spouseId')
      .populate('spouseId', 'firstName lastName fullName dateOfDeath isActive');

    /* Containers for event categories */
    const birthdayToday = [];
    const birthdayWeek = [];
    const anniversaryToday = [];
    const anniversaryWeek = [];
    const deathToday = [];
    const deathWeek = [];

    /* Categorize events */
    for (const m of members) {
      const alive = isAlive(m);

      /* Birthdays (only for living members) */
      if (alive && m.dob) {
        if (isTodayMatch(m.dob, today)) birthdayToday.push(m);
        if (isInWeek(m.dob, weekStart, weekEnd, today)) birthdayWeek.push(m);
      }

      /* Anniversaries (both spouses must be alive) */
      if (m.marriageDate && m.spouseId && isAlive(m) && isAlive(m.spouseId)) {
        const years = calcAnniversaryYears(m.marriageDate, today);
        const annivItem = { member: m, spouse: m.spouseId, years };

        if (isTodayMatch(m.marriageDate, today)) anniversaryToday.push(annivItem);
        if (isInWeek(m.marriageDate, weekStart, weekEnd, today)) anniversaryWeek.push(annivItem);
      }

      /* Death anniversaries (for deceased members) */
      if (m.dateOfDeath) {
        if (isTodayMatch(m.dateOfDeath, today)) deathToday.push(m);
        if (isInWeek(m.dateOfDeath, weekStart, weekEnd, today)) deathWeek.push(m);
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