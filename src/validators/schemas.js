const { z } = require('zod');

const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100)
});

const createEmployeeSchema = z.object({
  employeeCode: z.string().min(2).max(20),
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  mobile: z.string().min(10).max(15),
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  department: z.string().min(1).max(100),
  designation: z.string().min(1).max(100),
  joiningDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dutyDuration: z.number().int().min(60).max(1440).optional(),
  breakAllowance: z.number().int().min(0).max(480).optional()
});

const updateEmployeeSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  mobile: z.string().min(10).max(15).optional(),
  department: z.string().min(1).max(100).optional(),
  designation: z.string().min(1).max(100).optional(),
  dutyDuration: z.number().int().min(60).max(1440).optional(),
  breakAllowance: z.number().int().min(0).max(480).optional()
});

const punchInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  deviceTimestamp: z.string().optional(),
  deviceInfo: z.string().optional()
});

const punchOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  deviceTimestamp: z.string().optional()
});

const locationBatchSchema = z.object({
  locations: z.array(z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().min(0).optional(),
    speed: z.number().optional(),
    heading: z.number().optional(),
    altitude: z.number().optional(),
    deviceTimestamp: z.string(),
    locationSource: z.string().optional(),
    eventId: z.string().optional(),
    batteryLevel: z.number().int().min(0).max(100).optional(),
    isOfflineSync: z.boolean().optional()
  })).min(1).max(100)
});

const photoCaptureSchema = z.object({
  shopName: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  captureTimestamp: z.string()
});

const systemSettingsSchema = z.object({
  defaultDutyDuration: z.number().int().min(60).max(1440).optional(),
  defaultBreakAllowance: z.number().int().min(0).max(480).optional(),
  trackingInterval: z.number().int().min(10).max(300).optional(),
  minMovementDistance: z.number().int().min(5).max(500).optional(),
  minGpsAccuracy: z.number().int().min(10).max(500).optional(),
  stopDetectionRadius: z.number().int().min(10).max(500).optional(),
  stopDetectionDuration: z.number().int().min(1).max(60).optional(),
  maxPhotoSize: z.number().int().optional(),
  locationRetentionDays: z.number().int().min(1).max(3650).optional()
});

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    });
  }
};

module.exports = {
  loginSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  punchInSchema,
  punchOutSchema,
  locationBatchSchema,
  photoCaptureSchema,
  systemSettingsSchema,
  validate
};
