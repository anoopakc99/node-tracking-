const prisma = require('../config/database');

const getDashboardStats = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

  const [
    totalEmployees,
    activeEmployees,
    todaySessions,
    activeSessions,
    todayPhotos,
    todayShopVisits,
    staleTrackingCount
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.attendanceSession.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: {
        breakSessions: { where: { endTime: null } },
        trackingSessions: { where: { status: 'active' } }
      }
    }),
    prisma.attendanceSession.count({ where: { status: 'active' } }),
    prisma.capturedPhoto.count({ where: { captureTimestamp: { gte: today, lt: tomorrow } } }),
    prisma.shopVisit.count({ where: { visitTime: { gte: today, lt: tomorrow } } }),
    prisma.trackingSession.count({
      where: {
        status: 'active',
        OR: [
          { lastUpdateTime: null },
          { lastUpdateTime: { lt: staleThreshold } }
        ]
      }
    })
  ]);

  const presentToday = todaySessions.length;
  const absentToday = activeEmployees - presentToday;
  const onDutyNow = todaySessions.filter(s => s.status === 'active').length;
  const onBreakNow = todaySessions.filter(s =>
    s.status === 'active' && s.breakSessions.some(b => !b.endTime)
  ).length;
  const completedDuty = todaySessions.filter(s => s.status === 'completed').length;

  return {
    totalEmployees,
    activeEmployees,
    presentToday,
    absentToday: Math.max(0, absentToday),
    onDutyNow,
    onBreakNow,
    completedDuty,
    staleGps: staleTrackingCount,
    todayShopVisits,
    todayPhotos
  };
};

const getWeeklyAttendance = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const sessions = await prisma.attendanceSession.findMany({
    where: { date: { gte: weekAgo, lte: today } },
    select: { date: true }
  });

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const count = sessions.filter(s =>
      new Date(s.date).toISOString().split('T')[0] === dayStr
    ).length;
    days.push({
      date: dayStr,
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      count
    });
  }

  return days;
};

const getRecentActivity = async (limit = 10) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [recentPunches, recentBreaks, recentPhotos] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { date: { gte: today } },
      include: { employee: { select: { fullName: true, employeeCode: true } } },
      orderBy: { punchInTime: 'desc' },
      take: 5
    }),
    prisma.breakSession.findMany({
      where: { startTime: { gte: today } },
      include: { employee: { select: { fullName: true, employeeCode: true } } },
      orderBy: { startTime: 'desc' },
      take: 5
    }),
    prisma.capturedPhoto.findMany({
      where: { captureTimestamp: { gte: today } },
      include: { employee: { select: { fullName: true, employeeCode: true } } },
      orderBy: { captureTimestamp: 'desc' },
      take: 5
    })
  ]);

  const activities = [];

  recentPunches.forEach(p => {
    activities.push({
      type: 'punch_in',
      icon: '🟢',
      message: `${p.employee.fullName} punched in`,
      timestamp: p.punchInTime,
      employeeCode: p.employee.employeeCode
    });
    if (p.punchOutTime) {
      activities.push({
        type: 'punch_out',
        icon: '🔴',
        message: `${p.employee.fullName} punched out`,
        timestamp: p.punchOutTime,
        employeeCode: p.employee.employeeCode
      });
    }
  });

  recentBreaks.forEach(b => {
    activities.push({
      type: 'break_start',
      icon: '☕',
      message: `${b.employee.fullName} started break`,
      timestamp: b.startTime,
      employeeCode: b.employee.employeeCode
    });
  });

  recentPhotos.forEach(p => {
    activities.push({
      type: 'photo',
      icon: '📸',
      message: `${p.employee.fullName} captured photo${p.shopName ? ` at ${p.shopName}` : ''}`,
      timestamp: p.captureTimestamp,
      employeeCode: p.employee.employeeCode
    });
  });

  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return activities.slice(0, limit);
};

module.exports = {
  getDashboardStats,
  getWeeklyAttendance,
  getRecentActivity
};
