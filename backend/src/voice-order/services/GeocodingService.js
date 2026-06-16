const Place = require('../../models/Place');

class GeocodingService {
  constructor() {
    this.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  }

  /**
   * Resolves a textual location name to coordinates.
   * 1. Local DB (Place model) match
   * 2. Mapbox Geocoding API fallback
   * 3. Nominatim fallback
   * @param {string} locationName
   * @returns {Promise<{name:string, address:string, lat:number, lng:number}|null>}
   */
  async resolve(locationName) {
    const query = locationName.trim();
    if (!query) return null;

    console.log(`[GeocodingService] Resolving: "${query}"`);

    // 1. Try local DB match
    try {
      let places = [];
      try {
        places = await Place.find(
          { $text: { $search: query } },
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(3)
          .lean();
      } catch (_) {
        // Text index might not exist, fall through to regex
      }

      if (!places || places.length === 0) {
        places = await Place.find({
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { address: { $regex: query, $options: 'i' } },
          ],
        })
          .limit(3)
          .lean();
      }

      if (places && places.length > 0) {
        const best = places[0];
        console.log(`[GeocodingService] Local DB match: "${best.name}"`);
        return {
          name: best.name,
          address: best.address || '',
          lat: best.location.lat,
          lng: best.location.lng,
        };
      }
    } catch (dbErr) {
      console.warn('[GeocodingService] Local DB lookup failed:', dbErr.message);
    }

    // 2. Mapbox Geocoding API
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${this.mapboxToken}&country=uz&limit=1`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          console.log(`[GeocodingService] Mapbox match: "${feature.place_name}"`);
          return {
            name: feature.text || query,
            address: feature.place_name || '',
            lat: feature.center[1],
            lng: feature.center[0],
          };
        }
      }
    } catch (mapboxErr) {
      console.warn('[GeocodingService] Mapbox API failed:', mapboxErr.message);
    }

    // 3. Nominatim fallback
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}+Uzbekistan&format=json&limit=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'InFastGo-Backend/1.0' },
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const place = data[0];
          console.log(`[GeocodingService] Nominatim match: "${place.display_name}"`);
          return {
            name: query,
            address: place.display_name,
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon),
          };
        }
      }
    } catch (osmErr) {
      console.warn('[GeocodingService] Nominatim failed:', osmErr.message);
    }

    console.log(`[GeocodingService] Could not resolve: "${query}"`);
    return null;
  }
}

module.exports = GeocodingService;
