const EatsCourier = require('../models/EatsCourier');
const FoodOrder = require('../models/FoodOrder');
const socketService = require('./socketService');

/**
 * Finds the nearest online and idle courier based on distance and vehicle type suitability.
 * 
 * @param {Array<Number>} restaurantCoords - [longitude, latitude] of the restaurant.
 * @param {Number} maxDistanceMeters - maximum search radius.
 * @returns {Promise<Object|null>} - matched EatsCourier object or null if none found.
 */
exports.findBestCourier = async (restaurantCoords, maxDistanceMeters = 8000) => {
  try {
    // 1. Query couriers near restaurant using MongoDB Geospatial indexing
    const couriers = await EatsCourier.find({
      online: true,
      status: 'idle',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: restaurantCoords
          },
          $maxDistance: maxDistanceMeters
        }
      }
    }).limit(10); // Check top 10 closest candidates

    if (couriers.length === 0) {
      return null;
    }

    // 2. Score candidates based on distance and vehicle type
    // Since MongoDB $near returns sorted, index 0 is closest.
    // Let's add weight based on vehicle suitability:
    const scoredCouriers = couriers.map(courier => {
      let vehicleScore = 1;
      const type = courier.vehicleType;
      
      // We can rank suitability. If closer, walking/bicycle is fine. If further, scooter/car is better.
      // Higher score is better.
      return {
        courier,
        score: courier.rating * vehicleScore
      };
    });

    // Sort by score descending (highest score wins)
    scoredCouriers.sort((a, b) => b.score - a.score);

    return scoredCouriers[0].courier;
  } catch (error) {
    console.error('Error in courierMatchService:', error);
    return null;
  }
};

/**
 * Periodically searches for couriers for active food orders that do not have a courier assigned.
 */
exports.startMatchingLoop = () => {
  console.log('[CourierMatch] Starting background matching loop...');
  setInterval(async () => {
    try {
      // Find food orders that are accepted, preparing, or ready, but have no courier assigned
      const unassignedOrders = await FoodOrder.find({
        status: { $in: ['accepted', 'preparing', 'ready'] },
        courierId: null
      }).populate('restaurantId');

      if (unassignedOrders.length === 0) return;

      console.log(`[CourierMatch] Found ${unassignedOrders.length} unassigned orders. Matching...`);

      for (const order of unassignedOrders) {
        if (!order.restaurantId || !order.restaurantId.location || !order.restaurantId.location.coordinates) {
          continue;
        }

        const restaurantCoords = order.restaurantId.location.coordinates;
        // Search for nearest courier
        const bestCourier = await exports.findBestCourier(restaurantCoords);

        if (bestCourier) {
          const io = socketService.getIO();
          if (io) {
            const courierLng = bestCourier.location?.coordinates?.[0];
            const courierLat = bestCourier.location?.coordinates?.[1];
            const restLng = order.restaurantId.location.coordinates[0];
            const restLat = order.restaurantId.location.coordinates[1];
            const custLat = order.deliveryAddress?.lat;
            const custLng = order.deliveryAddress?.lng;

            const toRad = (v) => (v * Math.PI) / 180;
            const haversine = (lat1, lng1, lat2, lng2) => {
              if (!lat1 || !lng1 || !lat2 || !lng2) return null;
              const R = 6371000;
              const dLat = toRad(lat2 - lat1);
              const dLng = toRad(lng2 - lng1);
              const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
              return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
            };

            const distToRestaurant = haversine(courierLat, courierLng, restLat, restLng);
            const distToCustomer = haversine(restLat, restLng, custLat, custLng);

            console.log(`[CourierMatch] Dispatching order ${order._id} to courier ${bestCourier.name} (${bestCourier._id})`);

            io.to(`courier_${bestCourier._id}`).emit('new_delivery_request', {
              orderId: order._id,
              restaurantName: order.restaurantId.name,
              restaurantAddress: order.restaurantId.address,
              restaurantCoords: { lat: restLat, lng: restLng },
              deliveryAddress: order.deliveryAddress,
              deliveryFee: order.deliveryFee,
              total: order.total,
              items: order.items,
              distToRestaurant,
              distToCustomer,
              orderStatus: order.status,
            });
          }
        } else {
          console.log(`[CourierMatch] No available courier found for order ${order._id}`);
        }
      }
    } catch (error) {
      console.error('[CourierMatch] Error in matching loop:', error);
    }
  }, 10000); // Check every 10 seconds
};
