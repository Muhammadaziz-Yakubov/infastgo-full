const Place = require('../models/Place');

// GET /api/places?q=query&limit=20
exports.searchPlaces = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    let places;

    if (!q) {
      // Return first 20 places if no query
      places = await Place.find({}).limit(limit).lean();
    } else {
      // Try MongoDB text search first
      try {
        places = await Place.find(
          { $text: { $search: q } },
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .lean();
      } catch (textErr) {
        // Fallback to regex search if text index not ready
        places = await Place.find({
          name: { $regex: q, $options: 'i' },
        })
          .limit(limit)
          .lean();
      }

      // If text search returned nothing, fallback to regex
      if (!places || places.length === 0) {
        places = await Place.find({
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { address: { $regex: q, $options: 'i' } },
          ],
        })
          .limit(limit)
          .lean();
      }
    }

    return res.json({
      success: true,
      places: places.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        address: p.address,
        lat: p.location.lat,
        lng: p.location.lng,
      })),
    });
  } catch (err) {
    console.error('searchPlaces error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Helper to calculate distance in meters between two coordinates (Haversine formula)
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of the earth in m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in m
  return d;
}

// Helper to check if a point is inside a polygon (Ray-casting algorithm)
function isPointInPolygon(lat, lng, polygon) {
  let isInside = false;
  const x = lng;
  const y = lat;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

// GET /api/places/reverse?lat=41.3113&lng=69.2797
exports.reverseGeocode = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    // Find candidate places within ~2km bounding box for high performance
    const delta = 0.02; 
    const candidatePlaces = await Place.find({
      'location.lat': { $gte: lat - delta, $lte: lat + delta },
      'location.lng': { $gte: lng - delta, $lte: lng + delta },
    }).lean();

    let matchedPlace = null;
    let minDistance = Infinity;

    for (const place of candidatePlaces) {
      if (place.type === 'area' && place.points && place.points.length > 0) {
        if (isPointInPolygon(lat, lng, place.points)) {
          // If inside a polygon area, it matches
          matchedPlace = place;
          break;
        }
      } else {
        // Point type with radius (meters)
        const dist = getDistanceInMeters(lat, lng, place.location.lat, place.location.lng);
        const radius = place.radius || 50; // default 50m if radius is 0 or undefined
        if (dist <= radius) {
          if (dist < minDistance) {
            minDistance = dist;
            matchedPlace = place;
          }
        }
      }
    }

    if (matchedPlace) {
      return res.json({
        success: true,
        match: true,
        place: {
          id: matchedPlace._id.toString(),
          name: matchedPlace.name,
          address: matchedPlace.address,
          lat: matchedPlace.location.lat,
          lng: matchedPlace.location.lng,
        }
      });
    }

    return res.json({ success: true, match: false });
  } catch (err) {
    console.error('reverseGeocode error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/places/count
exports.getCount = async (req, res) => {
  try {
    const count = await Place.countDocuments();
    return res.json({ success: true, count });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

