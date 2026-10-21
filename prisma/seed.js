const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { initializeDefaultSettings } = require('../src/services/settingsService');

const prisma = new PrismaClient();

const main = async () => {
  await initializeDefaultSettings();

  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const employeePasswordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@fieldtrack.com',
      username: 'admin',
      password: adminPasswordHash,
      role: 'admin',
      isActive: true
    }
  });

  const employeesData = [
    {
      employeeCode: 'EMP001',
      fullName: 'Rajesh Kumar',
      email: 'rajesh.kumar@fieldtrack.com',
      mobile: '9876543210',
      username: 'rajesh.k',
      department: 'Sales',
      designation: 'Senior Field Executive',
      joiningDate: new Date('2024-01-15')
    },
    {
      employeeCode: 'EMP002',
      fullName: 'Priya Sharma',
      email: 'priya.sharma@fieldtrack.com',
      mobile: '9876543211',
      username: 'priya.s',
      department: 'Sales',
      designation: 'Area Sales Manager',
      joiningDate: new Date('2024-02-01')
    },
    {
      employeeCode: 'EMP003',
      fullName: 'Amit Patel',
      email: 'amit.patel@fieldtrack.com',
      mobile: '9876543212',
      username: 'amit.p',
      department: 'Service',
      designation: 'Field Service Technician',
      joiningDate: new Date('2024-03-10')
    },
    {
      employeeCode: 'EMP004',
      fullName: 'Sneha Verma',
      email: 'sneha.verma@fieldtrack.com',
      mobile: '9876543213',
      username: 'sneha.v',
      department: 'Operations',
      designation: 'Client Relationship Officer',
      joiningDate: new Date('2024-04-05')
    }
  ];

  const createdEmployees = [];
  for (const empData of employeesData) {
    const employee = await prisma.employee.upsert({
      where: { employeeCode: empData.employeeCode },
      update: {},
      create: {
        ...empData,
        password: employeePasswordHash,
        isActive: true,
        settings: {
          create: {
            dutyDuration: 540,
            breakAllowance: 60,
            trackingInterval: 30,
            minMovementDistance: 20,
            minGpsAccuracy: 100,
            stopDetectionRadius: 50,
            stopDetectionDuration: 10
          }
        }
      }
    });
    createdEmployees.push(employee);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const emp1 = createdEmployees[0];
  const emp2 = createdEmployees[1];

  const activeSession = await prisma.attendanceSession.create({
    data: {
      employeeId: emp1.id,
      date: today,
      punchInTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
      punchInLat: 28.6139,
      punchInLng: 77.2090,
      punchInAccuracy: 12.5,
      status: 'active',
      deviceInfo: 'Android 14 - Samsung Galaxy S23'
    }
  });

  await prisma.trackingSession.create({
    data: {
      employeeId: emp1.id,
      attendanceId: activeSession.id,
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: 'active',
      totalPoints: 5,
      lastLatitude: 28.6250,
      lastLongitude: 77.2185,
      lastUpdateTime: new Date()
    }
  });

  const baseLat = 28.6139;
  const baseLng = 77.2090;
  for (let i = 0; i < 5; i++) {
    await prisma.employeeLocation.create({
      data: {
        employeeId: emp1.id,
        attendanceId: activeSession.id,
        latitude: baseLat + (i * 0.0028),
        longitude: baseLng + (i * 0.0024),
        accuracy: 10.0,
        speed: 15.5,
        heading: 45.0,
        altitude: 215.0,
        batteryLevel: 85 - (i * 2),
        deviceTimestamp: new Date(Date.now() - (4 - i * 0.8) * 60 * 60 * 1000),
        locationSource: 'gps',
        trackingStatus: 'active'
      }
    });
  }

  await prisma.breakSession.create({
    data: {
      employeeId: emp1.id,
      attendanceId: activeSession.id,
      startTime: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      duration: 30,
      isExcess: false,
      excessDuration: 0,
      autoEnded: false,
      endReason: 'manual'
    }
  });

  const shopVisit = await prisma.shopVisit.create({
    data: {
      employeeId: emp1.id,
      attendanceId: activeSession.id,
      shopName: 'Sharma Electronics & Appliances',
      description: 'Quarterly dealer stock audit and product display verification.',
      latitude: 28.6210,
      longitude: 77.2150,
      accuracy: 8.5,
      visitTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000)
    }
  });

  await prisma.capturedPhoto.create({
    data: {
      employeeId: emp1.id,
      attendanceId: activeSession.id,
      shopVisitId: shopVisit.id,
      shopName: 'Sharma Electronics & Appliances',
      description: 'Store entrance and main counter display.',
      imagePath: 'uploads/photos/sample_store_1.jpg',
      thumbnailPath: 'uploads/photos/thumb_sample_store_1.jpg',
      latitude: 28.6210,
      longitude: 77.2150,
      accuracy: 8.5,
      captureTimestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
      uploadStatus: 'uploaded',
      fileSize: 1024000,
      mimeType: 'image/jpeg'
    }
  });

  await prisma.employeeStop.create({
    data: {
      employeeId: emp1.id,
      attendanceId: activeSession.id,
      latitude: 28.6210,
      longitude: 77.2150,
      accuracy: 8.5,
      arrivalTime: new Date(Date.now() - 1.8 * 60 * 60 * 1000),
      departureTime: new Date(Date.now() - 1.2 * 60 * 60 * 1000),
      duration: 36,
      isQualifying: true,
      sampleCount: 12,
      locationName: 'Connaught Place Commercial Area'
    }
  });

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  yesterday.setHours(0, 0, 0, 0);

  const completedSession = await prisma.attendanceSession.create({
    data: {
      employeeId: emp2.id,
      date: yesterday,
      punchInTime: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000),
      punchInLat: 28.5355,
      punchInLng: 77.3910,
      punchInAccuracy: 15.0,
      punchOutTime: new Date(yesterday.getTime() + 18 * 60 * 60 * 1000),
      punchOutLat: 28.5358,
      punchOutLng: 77.3915,
      punchOutAccuracy: 14.0,
      grossDuration: 540,
      totalBreakTime: 45,
      netWorkingTime: 495,
      excessBreakTime: 0,
      status: 'completed',
      deviceInfo: 'iOS 17 - iPhone 14'
    }
  });

  console.log('Database seeded successfully');
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
