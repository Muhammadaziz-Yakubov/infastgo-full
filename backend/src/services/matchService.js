const Driver = require('../models/Driver');

/**
 * Calculate distance between two coordinates in km using the Haversine formula.
 */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

/**
 * Finds the nearest online and active driver.
 * @param {number} pickupLat - Latitude of ride pickup
 * @param {number} pickupLng - Longitude of ride pickup
 * @param {Array<string>} excludeDriverIds - List of driver IDs to exclude (e.g. who rejected)
 * @returns {Promise<Driver|null>} Nearest driver model or null
 */
const findNearestDriver = async (pickupLat, pickupLng, excludeDriverIds = [], tariff = 'standart') => {
  try {
    // Find all online, active, unblocked drivers matching the tariff
    const drivers = await Driver.find({
      status: 'online',
      isActive: true,
      isBlocked: { $ne: true },
      _id: { $nin: excludeDriverIds },
      tariffs: { $in: [tariff] },
    });

    if (drivers.length === 0) {
      return null;
    }

    // Sort drivers by distance to pickup location
    let nearestDriver = null;
    let minDistance = Infinity;
    const MAX_PICKUP_DISTANCE = 10; // Max pickup radius is 10 km

    for (const driver of drivers) {
      const { lat, lng } = driver.currentLocation;
      if (lat && lng) {
        const dist = getDistance(pickupLat, pickupLng, lat, lng);
        // Find the absolute closest online driver within the max pickup distance
        if (dist < minDistance && dist <= MAX_PICKUP_DISTANCE) {
          minDistance = dist;
          nearestDriver = driver;
        }
      }
    }

    return nearestDriver;
  } catch (error) {
    console.error('Error in findNearestDriver:', error);
    return null;
  }
};

module.exports = {
  getDistance,
  findNearestDriver,
};
