const prisma = require('../config/database');

const getSystemSettings = async () => {
  const settings = await prisma.systemSettings.findMany({
    orderBy: { category: 'asc' }
  });

  const result = {};
  settings.forEach(s => {
    let value = s.settingValue;
    if (s.settingType === 'number') value = parseFloat(value);
    if (s.settingType === 'boolean') value = value === 'true';
    result[s.settingKey] = { value, type: s.settingType, description: s.description, category: s.category };
  });

  return result;
};

const updateSystemSettings = async (settings) => {
  const operations = Object.entries(settings).map(([key, value]) => {
    return prisma.systemSettings.upsert({
      where: { settingKey: key },
      update: { settingValue: String(value) },
      create: {
        settingKey: key,
        settingValue: String(value),
        settingType: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
        category: getSettingCategory(key)
      }
    });
  });

  await prisma.$transaction(operations);
  return getSystemSettings();
};

const getSettingCategory = (key) => {
  if (key.includes('duty') || key.includes('break') || key.includes('Break') || key.includes('Duty')) return 'attendance';
  if (key.includes('tracking') || key.includes('gps') || key.includes('stop') || key.includes('Tracking') || key.includes('Gps') || key.includes('Stop') || key.includes('movement') || key.includes('Movement')) return 'tracking';
  if (key.includes('photo') || key.includes('Photo') || key.includes('upload') || key.includes('Upload')) return 'photos';
  return 'general';
};

const initializeDefaultSettings = async () => {
  const defaults = [
    { key: 'defaultDutyDuration', value: '540', type: 'number', desc: 'Default duty duration in minutes', cat: 'attendance' },
    { key: 'defaultBreakAllowance', value: '60', type: 'number', desc: 'Default break allowance in minutes', cat: 'attendance' },
    { key: 'trackingInterval', value: '30', type: 'number', desc: 'GPS tracking interval in seconds', cat: 'tracking' },
    { key: 'minMovementDistance', value: '20', type: 'number', desc: 'Minimum movement distance in meters', cat: 'tracking' },
    { key: 'minGpsAccuracy', value: '100', type: 'number', desc: 'Minimum GPS accuracy in meters', cat: 'tracking' },
    { key: 'stopDetectionRadius', value: '50', type: 'number', desc: 'Stop detection radius in meters', cat: 'tracking' },
    { key: 'stopDetectionDuration', value: '10', type: 'number', desc: 'Stop detection duration in minutes', cat: 'tracking' },
    { key: 'maxPhotoSize', value: '5242880', type: 'number', desc: 'Maximum photo upload size in bytes', cat: 'photos' },
    { key: 'locationRetentionDays', value: '365', type: 'number', desc: 'Location data retention in days', cat: 'general' }
  ];

  for (const setting of defaults) {
    await prisma.systemSettings.upsert({
      where: { settingKey: setting.key },
      update: {},
      create: {
        settingKey: setting.key,
        settingValue: setting.value,
        settingType: setting.type,
        description: setting.desc,
        category: setting.cat
      }
    });
  }
};

module.exports = {
  getSystemSettings,
  updateSystemSettings,
  initializeDefaultSettings
};
