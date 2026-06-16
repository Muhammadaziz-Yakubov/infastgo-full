const Settings = require('../models/Settings');

/**
 * Get the global system settings. Creates them if they do not exist.
 */
const getSettings = async () => {
  let settings = await Settings.findById('system_settings');
  if (!settings) {
    settings = await Settings.create({
      _id: 'system_settings',
      commissionPercent: 10,
      warningDebtLimit: 50000,
      blockDebtLimit: 100000,
    });
  }
  return settings;
};

module.exports = {
  getSettings,
};
