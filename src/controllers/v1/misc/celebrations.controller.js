const Member = require('../../../models/member.model');

// Helpers
const isAlive = (m) => m && m.isActive === true && !m.dateOfDeath;

const getWeekRange = (today = new Date()) => {
  const day = today.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = (day + 6) % 7; // make Monday the first day
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(today.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const toMonthDay = (d) => ({ month: d.getMonth(), day: d.getDate() });

const isTodayMatch = (dateValue, today) => {
  if (!dateValue) return false;
  const a = toMonthDay(new Date(dateValue));
  const b = toMonthDay(today);
  return a.month === b.month && a.day === b.day;
};

const isInWeek = (dateValue, weekStart, weekEnd, today) => {
  if (!dateValue) return false;

  const monthDay = toMonthDay(new Date(dateValue));
  const year = today.getFullYear();

  // Build event date in current year
  const eventDate = new Date(year, monthDay.month, monthDay.day);
  eventDate.setHours(12, 0, 0, 0);

  // If week crosses year boundary, also check next year's date
  const eventDateNextYear = new Date(year + 1, monthDay.month, monthDay.day);
  eventDateNextYear.setHours(12, 0, 0, 0);

  return (
    (eventDate >= weekStart && eventDate <= weekEnd) ||
    (eventDateNextYear >= weekStart && eventDateNextYear <= weekEnd)
  );
};

const calcAnniversaryYears = (marriageDate, today) => {
  if (!marriageDate) return null;
  const m = new Date(marriageDate);
  let years = today.getFullYear() - m.getFullYear();

  // If anniversary hasn't occurred yet this year, subtract one
  const annivThisYear = new Date(today.getFullYear(), m.getMonth(), m.getDate());
  if (today < annivThisYear) years -= 1;

  return years < 0 ? 0 : years;
};

// Controller: combined summary
exports.getEventsSummary = async (req, res, next) => {
  try {
    const today = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(today);

    // Load members needed for birthday/death/anniversary checks
    const members = await Member.find({})
      .select('firstName lastName fullName dob marriageDate dateOfDeath isActive spouseId')
      .populate('spouseId', 'firstName lastName fullName dateOfDeath isActive');

    // Birthdays (only alive)
    const birthdayToday = [];
    const birthdayWeek = [];

    // Anniversaries (both spouses alive)
    const anniversaryToday = [];
    const anniversaryWeek = [];

    // Death anniversaries (member is deceased)
    const deathToday = [];
    const deathWeek = [];

    for (const m of members) {
      const alive = isAlive(m);

      // Birthdays
      if (alive && m.dob) {
        if (isTodayMatch(m.dob, today)) birthdayToday.push(m);
        if (isInWeek(m.dob, weekStart, weekEnd, today)) birthdayWeek.push(m);
      }

      // Anniversaries: require marriageDate, spouse exists, both alive
      if (m.marriageDate && m.spouseId && isAlive(m) && isAlive(m.spouseId)) {
        const years = calcAnniversaryYears(m.marriageDate, today);
        const annivItem = { member: m, spouse: m.spouseId, years };

        if (isTodayMatch(m.marriageDate, today)) anniversaryToday.push(annivItem);
        if (isInWeek(m.marriageDate, weekStart, weekEnd, today)) anniversaryWeek.push(annivItem);
      }

      // Death anniversaries: member is deceased
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