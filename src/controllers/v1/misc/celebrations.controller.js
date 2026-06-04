const Member = require('../../../models/member.model');
const Family = require('../../../models/family.model');

const CELEBRATION_CACHE_TTL_MS = 60 * 1000;
const IST_TIMEZONE = 'Asia/Kolkata';
const celebrationSnapshotCache = {
  value: null,
  expiresAt: 0,
  inFlight: null
};

/* ========== Helper Functions ========== */

/**
 * Check if a member is active
 */
const isActiveMember = (m) => m && m.isActive === true;

/**
 * Convert a Date to IST (Indian Standard Time, UTC+5:30)
 */
const toIST = (date) => {
  // Get UTC time in ms, add 5.5 hours in ms
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(date.getTime() + istOffset);
};

/**
 * Get start and end dates for the current week (Monday-Sunday) in IST
 */
const getWeekRange = (today = new Date()) => {
  const istToday = toIST(today);
  const day = istToday.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(istToday);
  start.setHours(0, 0, 0, 0);
  start.setDate(istToday.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Extract month and day from a date (IST)
 */
const toMonthDay = (d) => {
  const ist = toIST(d);
  return { month: ist.getMonth(), day: ist.getDate() };
};

/**
 * Check if a date matches today (ignoring year, using IST)
 */
const isTodayMatch = (dateValue, today) => {
  if (!dateValue) return false;
  const a = toMonthDay(new Date(dateValue));
  const b = toMonthDay(today);
  return a.month === b.month && a.day === b.day;
};

/**
 * Check if an annual date falls within a given week (IST)
 * (Handles year boundary crossing for recurring events)
 */
const isInWeek = (dateValue, weekStart, weekEnd, today) => {
  if (!dateValue) return false;

  const monthDay = toMonthDay(new Date(dateValue));
  const year = toIST(today).getFullYear();

  // Check event date in current year (IST)
  const eventDate = new Date(toIST(new Date(year, monthDay.month, monthDay.day, 12, 0, 0, 0)));
  // Also check next year's date in case week crosses year boundary (IST)
  const eventDateNextYear = new Date(toIST(new Date(year + 1, monthDay.month, monthDay.day, 12, 0, 0, 0)));

  return (
    (eventDate >= weekStart && eventDate <= weekEnd) ||
    (eventDateNextYear >= weekStart && eventDateNextYear <= weekEnd)
  );
};

/**
 * Calculate years since marriage date (IST)
 */
const calcAnniversaryYears = (marriageDate, today) => {
  if (!marriageDate) return null;
  const m = toIST(new Date(marriageDate));
  const t = toIST(today);
  let years = t.getFullYear() - m.getFullYear();

  // Adjust if anniversary hasn't occurred yet this year (IST)
  const annivThisYear = new Date(t.getFullYear(), m.getMonth(), m.getDate());
  if (t < annivThisYear) years -= 1;

  return years < 0 ? 0 : years;
};

/**
 * Calculate years since a date (used for death anniversaries, IST)
 */
const calcYearsSinceDate = (dateValue, today) => {
  if (!dateValue) return null;
  const d = toIST(new Date(dateValue));
  const t = toIST(today);
  let years = t.getFullYear() - d.getFullYear();

  const thisYearDate = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (t < thisYearDate) years -= 1;

  return years < 0 ? 0 : years;
};

const getPagination = (query) => {
  const limit = Math.min(parseInt(query.limit, 10) || 50, 100);
  let skip = 0;

  if (query.offset !== undefined) {
    skip = Math.max(parseInt(query.offset, 10) || 0, 0);
  } else {
    skip = Math.max(parseInt(query.skip, 10) || 0, 0);
  }

  return { limit, skip };
};

const normalizePeriod = (period) => {
  if (period === 'today' || period === 'week' || period === 'all') return period;
  return 'all';
};

const getMonthDayKey = (date) => {
  const ist = toIST(date);
  const month = String(ist.getMonth() + 1).padStart(2, '0');
  const day = String(ist.getDate()).padStart(2, '0');
  return `${month}-${day}`;
};

const getWeekMonthDayKeys = (today) => {
  const { start: weekStart } = getWeekRange(today);
  const keys = [];

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    keys.push(getMonthDayKey(d));
  }

  return keys;
};

const getPeriodMonthDaySet = (period, todayKey, weekKeys) => {
  if (period === 'today') return [todayKey];
  if (period === 'week') return weekKeys;
  return Array.from(new Set([todayKey, ...weekKeys]));
};

const buildMonthDayExpr = (dateFieldName, monthDaySet) => ({
  $in: [
    {
      $dateToString: {
        format: '%m-%d',
        date: `$${dateFieldName}`,
        timezone: IST_TIMEZONE
      }
    },
    monthDaySet
  ]
});

const getFamilyNameMap = async (members) => {
  const familyIds = Array.from(
    new Set(
      members
        .map((m) => m.familyId)
        .filter(Boolean)
        .map((id) => String(id))
    )
  );

  if (familyIds.length === 0) return new Map();

  const families = await Family.find({ _id: { $in: familyIds } })
    .select('_id familyName')
    .lean();

  return new Map(families.map((f) => [String(f._id), f.familyName]));
};

const getCelebrationContext = async () => {
  const members = await Member.find({})
    .select('firstName lastName fullName dob marriageDate dateOfDeath isActive spouseId familyId')
    .lean();

  const familyIds = Array.from(new Set(members.map((m) => m.familyId).filter(Boolean)));
  const families = await Family.find({ _id: { $in: familyIds } })
    .select('_id familyName')
    .lean();

  const familyById = new Map(families.map((f) => [String(f._id), f.familyName]));
  const memberById = new Map(members.map((member) => [String(member._id), member]));

  const getMemberBasic = (m) => ({
    _id: m._id,
    firstName: m.firstName,
    lastName: m.lastName,
    fullName: m.fullName,
    familyName: familyById.get(String(m.familyId)) || null
  });

  return { members, memberById, getMemberBasic };
};

const buildCelebrationSnapshot = async () => {
  const now = new Date();
  const today = now;
  const { start: weekStart, end: weekEnd } = getWeekRange(today);
  const { members, memberById, getMemberBasic } = await getCelebrationContext();

  const birthdayToday = [];
  const birthdayWeek = [];
  const anniversaryToday = [];
  const anniversaryWeek = [];
  const deathToday = [];
  const deathWeek = [];
  const processedAnniversaryPairs = new Set();

  for (const m of members) {
    if (isActiveMember(m) && m.dob) {
      const isToday = isTodayMatch(m.dob, today);
      const years = calcYearsSinceDate(m.dob, today);
      const item = { member: getMemberBasic(m), years };
      if (isToday) birthdayToday.push(item);
      if (!isToday && isInWeek(m.dob, weekStart, weekEnd, today)) birthdayWeek.push(item);
    }

    if (m.marriageDate && m.spouseId && isActiveMember(m)) {
      const spouse = memberById.get(String(m.spouseId));
      if (isActiveMember(spouse)) {
        const memberId = String(m._id);
        const spouseId = String(spouse._id);
        const pairKey = [memberId, spouseId].sort().join(':');

        if (!processedAnniversaryPairs.has(pairKey)) {
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
      }
    }

    if (m.dateOfDeath && m.isActive === false) {
      const isToday = isTodayMatch(m.dateOfDeath, today);
      const years = calcYearsSinceDate(m.dateOfDeath, today);
      const item = { member: getMemberBasic(m), years };
      if (isToday) deathToday.push(item);
      if (!isToday && isInWeek(m.dateOfDeath, weekStart, weekEnd, today)) deathWeek.push(item);
    }
  }

  return {
    birthdays: { today: birthdayToday, thisWeek: birthdayWeek },
    anniversaries: { today: anniversaryToday, thisWeek: anniversaryWeek },
    deathAnniversaries: { today: deathToday, thisWeek: deathWeek }
  };
};

const getCelebrationSnapshot = async () => {
  const now = Date.now();

  if (celebrationSnapshotCache.value && celebrationSnapshotCache.expiresAt > now) {
    return celebrationSnapshotCache.value;
  }

  if (celebrationSnapshotCache.inFlight) {
    return celebrationSnapshotCache.inFlight;
  }

  celebrationSnapshotCache.inFlight = buildCelebrationSnapshot()
    .then((snapshot) => {
      celebrationSnapshotCache.value = snapshot;
      celebrationSnapshotCache.expiresAt = Date.now() + CELEBRATION_CACHE_TTL_MS;
      return snapshot;
    })
    .finally(() => {
      celebrationSnapshotCache.inFlight = null;
    });

  return celebrationSnapshotCache.inFlight;
};

/* ========== Controller ========== */

/**
 * Get upcoming celebrations summary
 * GET /events-summary
 * Returns: birthdays, anniversaries, death anniversaries for today and this week
 */
exports.getEventsSummary = async (req, res, next) => {
  try {
    const snapshot = await getCelebrationSnapshot();

    res.status(200).json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get birthdays list with pagination
 * GET /celebrations/birthdays
 * Query: period=today|week|all (default all), limit, skip/offset
 */
exports.getBirthdays = async (req, res, next) => {
  try {
    const period = normalizePeriod(req.query.period || 'all');
    const { limit, skip } = getPagination(req.query);
    const today = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(today);
    const todayKey = getMonthDayKey(today);
    const weekKeys = getWeekMonthDayKeys(today);
    const monthDaySet = getPeriodMonthDaySet(period, todayKey, weekKeys);

    const filter = {
      isActive: true,
      dob: { $ne: null },
      $expr: buildMonthDayExpr('dob', monthDaySet)
    };

    const [count, members] = await Promise.all([
      Member.countDocuments(filter),
      Member.find(filter)
        .sort({ _id: 1 })
        .skip(skip)
        .limit(limit)
        .select('firstName lastName fullName dob familyId')
        .lean()
    ]);

    const familyById = await getFamilyNameMap(members);

    const items = members.map((m) => ({
      member: {
        _id: m._id,
        firstName: m.firstName,
        lastName: m.lastName,
        fullName: m.fullName,
        familyName: familyById.get(String(m.familyId)) || null
      },
      years: calcYearsSinceDate(m.dob, today)
    }));

    let todayItems = [];
    let thisWeekItems = [];

    if (period === 'today') {
      todayItems = items;
    } else {
      members.forEach((m, idx) => {
        if (isTodayMatch(m.dob, today)) {
          todayItems.push(items[idx]);
        }

        if (isInWeek(m.dob, weekStart, weekEnd, today)) {
          thisWeekItems.push(items[idx]);
        }
      });
    }

    res.status(200).json({
      success: true,
      period,
      count,
      pageCount: items.length,
      data: {
        today: todayItems,
        thisWeek: thisWeekItems,
        paginated: items
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get anniversaries list with pagination
 * GET /celebrations/anniversaries
 * Query: period=today|week|all (default all), limit, skip/offset
 */
exports.getAnniversaries = async (req, res, next) => {
  try {
    const period = normalizePeriod(req.query.period || 'all');
    const { limit, skip } = getPagination(req.query);
    const today = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(today);
    const todayKey = getMonthDayKey(today);
    const weekKeys = getWeekMonthDayKeys(today);
    const monthDaySet = getPeriodMonthDaySet(period, todayKey, weekKeys);

    const pipeline = [
      {
        $match: {
          isActive: true,
          marriageDate: { $ne: null },
          spouseId: { $ne: null },
          $expr: buildMonthDayExpr('marriageDate', monthDaySet)
        }
      },
      {
        $lookup: {
          from: 'members',
          localField: 'spouseId',
          foreignField: '_id',
          as: 'spouse'
        }
      },
      { $unwind: '$spouse' },
      { $match: { 'spouse.isActive': true } },
      {
        $addFields: {
          memberIdStr: { $toString: '$_id' },
          spouseIdStr: { $toString: '$spouse._id' }
        }
      },
      {
        $addFields: {
          pairKey: {
            $cond: [
              { $lte: ['$memberIdStr', '$spouseIdStr'] },
              { $concat: ['$memberIdStr', ':', '$spouseIdStr'] },
              { $concat: ['$spouseIdStr', ':', '$memberIdStr'] }
            ]
          }
        }
      },
      { $sort: { _id: 1 } },
      {
        $group: {
          _id: '$pairKey',
          doc: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$doc' } },
      {
        $facet: {
          meta: [{ $count: 'count' }],
          data: [
            { $sort: { _id: 1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                fullName: 1,
                familyId: 1,
                marriageDate: 1,
                spouse: {
                  _id: 1,
                  firstName: 1,
                  lastName: 1,
                  fullName: 1,
                  familyId: 1
                }
              }
            }
          ]
        }
      }
    ];

    const result = await Member.aggregate(pipeline);
    const count = result[0]?.meta?.[0]?.count || 0;
    const rows = result[0]?.data || [];

    const membersForFamilyMap = rows.flatMap((row) => [
      {
        familyId: row.familyId
      },
      {
        familyId: row.spouse?.familyId
      }
    ]);
    const familyById = await getFamilyNameMap(membersForFamilyMap);

    const items = rows.map((row) => ({
      member: {
        _id: row._id,
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: row.fullName,
        familyName: familyById.get(String(row.familyId)) || null
      },
      spouse: {
        _id: row.spouse?._id,
        firstName: row.spouse?.firstName,
        lastName: row.spouse?.lastName,
        fullName: row.spouse?.fullName,
        familyName: familyById.get(String(row.spouse?.familyId)) || null
      },
      years: calcAnniversaryYears(row.marriageDate, today)
    }));

    let todayItems = [];
    let thisWeekItems = [];

    if (period === 'today') {
      todayItems = items;
    } else {
      rows.forEach((row, idx) => {
        if (isTodayMatch(row.marriageDate, today)) {
          todayItems.push(items[idx]);
        }

        if (isInWeek(row.marriageDate, weekStart, weekEnd, today)) {
          thisWeekItems.push(items[idx]);
        }
      });
    }

    res.status(200).json({
      success: true,
      period,
      count,
      pageCount: items.length,
      data: {
        today: todayItems,
        thisWeek: thisWeekItems,
        paginated: items
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get death anniversaries list with pagination
 * GET /celebrations/death-anniversaries
 * Query: period=today|week|all (default all), limit, skip/offset
 */
exports.getDeathAnniversaries = async (req, res, next) => {
  try {
    const period = normalizePeriod(req.query.period || 'all');
    const { limit, skip } = getPagination(req.query);
    const today = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(today);
    const todayKey = getMonthDayKey(today);
    const weekKeys = getWeekMonthDayKeys(today);
    const monthDaySet = getPeriodMonthDaySet(period, todayKey, weekKeys);

    const filter = {
      isActive: false,
      dateOfDeath: { $ne: null },
      $expr: buildMonthDayExpr('dateOfDeath', monthDaySet)
    };

    const [count, members] = await Promise.all([
      Member.countDocuments(filter),
      Member.find(filter)
        .sort({ _id: 1 })
        .skip(skip)
        .limit(limit)
        .select('firstName lastName fullName dateOfDeath familyId')
        .lean()
    ]);

    const familyById = await getFamilyNameMap(members);

    const items = members.map((m) => ({
      member: {
        _id: m._id,
        firstName: m.firstName,
        lastName: m.lastName,
        fullName: m.fullName,
        familyName: familyById.get(String(m.familyId)) || null
      },
      years: calcYearsSinceDate(m.dateOfDeath, today)
    }));

    let todayItems = [];
    let thisWeekItems = [];

    if (period === 'today') {
      todayItems = items;
    } else {
      members.forEach((m, idx) => {
        if (isTodayMatch(m.dateOfDeath, today)) {
          todayItems.push(items[idx]);
        }

        if (isInWeek(m.dateOfDeath, weekStart, weekEnd, today)) {
          thisWeekItems.push(items[idx]);
        }
      });
    }

    res.status(200).json({
      success: true,
      period,
      count,
      pageCount: items.length,
      data: {
        today: todayItems,
        thisWeek: thisWeekItems,
        paginated: items
      }
    });
  } catch (error) {
    next(error);
  }
};