import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
  Animated,
  Image,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { api } from '../services/api';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Polyline, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const PREDEFINED_LOCATIONS = [
  { id: '1', name: 'Milliy Bog\'', lat: 41.3023, lng: 69.2312 },
  { id: '2', name: 'Toshkent City Mall', lat: 41.3146, lng: 69.2435 },
  { id: '3', name: 'Chorsu Bozori', lat: 41.3268, lng: 69.2285 },
  { id: '4', name: 'Amir Temur Xiyoboni', lat: 41.3113, lng: 69.2797 },
  { id: '5', name: 'Toshkent Shimoliy Vokzali', lat: 41.2917, lng: 69.2892 },
];

export default function HomeScreen({ user, onRideCreated, onViewProfile, onLogout, onViewHistory, onViewServices }) {
  const insets = useSafeAreaInsets();
  const [pickup, setPickup] = useState(PREDEFINED_LOCATIONS[0]);
  const [destination, setDestination] = useState(null); // start with null destination so user clicks "Qayerga boramiz?"
  const [selectingType, setSelectingType] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [selectedTariff, setSelectedTariff] = useState('komfort'); // Comfort selected by default
  const [centerAddress, setCenterAddress] = useState("Manzil yuklanmoqda...");
  const [isMapSelecting, setIsMapSelecting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'click'
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [animatedCoords, setAnimatedCoords] = useState([]);
  const [acSelected, setAcSelected] = useState(false);
  const [luggageSelected, setLuggageSelected] = useState(false);

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [promoVisible, setPromoVisible] = useState(false);
  const [promoApplied, setPromoApplied] = useState(null); // { code, discount, message }
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  // Geolocation state
  const [userLocation, setUserLocation] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const mapRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for user location marker
  useEffect(() => {
    if (userLocation) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [userLocation]);

  // Auto-get location on app start
  useEffect(() => {
    handleGetUserLocation();
  }, []);

  const handleGetUserLocation = async () => {
    setLocatingUser(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS === 'web') {
          alert('Joylashuvni aniqlash uchun brauzer sozlamalarida joylashuv ruxsatini yoqing.');
        } else {
          Alert.alert(
            'Ruxsat berilmadi',
            'Joylashuvni aniqlash uchun ilova sozlamalarida joylashuv ruxsatini yoqing.',
            [{ text: 'OK' }]
          );
        }
        setLocatingUser(false);
        return;
      }

      let location = null;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
        });
      } catch (e) {
        console.warn('getCurrentPosition failed, trying last known:', e);
        location = await Location.getLastKnownPositionAsync();
      }

      if (!location) {
        try {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
        } catch (e2) {
          console.warn('Low accuracy also failed:', e2);
        }
      }

      if (!location) {
        if (Platform.OS === 'web') {
          alert('Joylashuvni aniqlab bo\'lmadi. GPS yoqilganligini tekshiring.');
        } else {
          Alert.alert('Xatolik', 'Joylashuvni aniqlab bo\'lmadi. GPS yoqilganligini tekshiring.');
        }
        setLocatingUser(false);
        return;
      }

      const { latitude, longitude } = location.coords;
      setUserLocation({ lat: latitude, lng: longitude });

      // Animate map to user location (native)
      if (Platform.OS !== 'web' && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 800);
      }

      // Animate map to user location (web/Mapbox)
      if (Platform.OS === 'web' && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({
          center: [longitude, latitude],
          zoom: 16,
          duration: 800,
        });
      }

      // Reverse geocode for address
      const addressName = await reverseGeocodeLocation(latitude, longitude);

      // Set as pickup location
      const myLoc = {
        id: `my_location_${Date.now()}`,
        name: addressName,
        lat: latitude,
        lng: longitude,
      };
      setPickup(myLoc);

    } catch (err) {
      console.warn('Location error:', err);
      if (Platform.OS === 'web') {
        alert('Joylashuvni aniqlab bo\'lmadi. Qayta urinib ko\'ring.');
      } else {
        Alert.alert('Xatolik', 'Joylashuvni aniqlab bo\'lmadi. Qayta urinib ko\'ring.');
      }
    } finally {
      setLocatingUser(false);
    }
  };

  const reverseGeocodeLocation = async (lat, lng) => {
    try {
      const dbMatch = await api.reverseGeocode(lat, lng);
      if (dbMatch && dbMatch.success && dbMatch.match && dbMatch.place) {
        return dbMatch.place.name;
      }
    } catch (e) {}

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=uz,ru,en`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'InFastGo/1.0 (muham@users.noreply.github.com)' }
      });
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        let parts = [];
        const nameOfPlace = data.name || addr.amenity || addr.shop;
        if (nameOfPlace) parts.push(nameOfPlace);
        if (addr.house_number) parts.push(addr.house_number);
        if (addr.road) parts.push(addr.road);
        if (addr.neighbourhood) parts.push(addr.neighbourhood);
        else if (addr.suburb) parts.push(addr.suburb);
        if (parts.length > 0) return parts.join(', ');
        return data.display_name;
      }
    } catch (e) {}

    return `Koordinata (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  useEffect(() => {
    if (!selectingType) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [selectingType]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await api.searchPlaces(searchQuery);
        if (res && res.success) {
          setSearchResults(res.places || []);
        }
      } catch (err) {
        console.warn('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const isMapSelectingRef = useRef(isMapSelecting);
  useEffect(() => { isMapSelectingRef.current = isMapSelecting; }, [isMapSelecting]);

  // Animations
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: 1, tension: 50, friction: 9, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchRouteDirections = async (pickupLoc, destLoc) => {
    if (!pickupLoc || !destLoc || pickupLoc.id === destLoc.id) {
      setRouteCoords([]);
      return;
    }
    try {
      const token = 'pk.eyJ1IjoieWFrdWJvdmRldiIsImEiOiJjbW1wNnprYWIwanlxMnBzZHg1ajFoeXowIn0' + '.' + 'mBQl5gkRN8abAbQhYrHPxA';
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupLoc.lng},${pickupLoc.lat};${destLoc.lng},${destLoc.lat}?geometries=geojson&overview=full&access_token=${token}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        }));
        setRouteCoords(coords);
        if (Platform.OS !== 'web' && mapRef.current && coords.length > 0) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 80, right: 50, bottom: 380, left: 50 },
            animated: true,
          });
        }
      } else {
        setRouteCoords([
          { latitude: pickupLoc.lat, longitude: pickupLoc.lng },
          { latitude: destLoc.lat, longitude: destLoc.lng }
        ]);
      }
    } catch (err) {
      console.warn('Error fetching route directions:', err);
      setRouteCoords([
        { latitude: pickupLoc.lat, longitude: pickupLoc.lng },
        { latitude: destLoc.lat, longitude: destLoc.lng }
      ]);
    }
  };

  useEffect(() => {
    if (!isMapSelecting && pickup && destination) {
      fetchRouteDirections(pickup, destination);
    } else {
      setRouteCoords([]);
    }
  }, [pickup, destination, isMapSelecting]);

  useEffect(() => {
    if (routeCoords.length === 0) {
      setAnimatedCoords([]);
      return;
    }

    let currentFrame = 0;
    const totalSteps = Math.min(routeCoords.length, 40);
    const stepSize = Math.max(1, Math.floor(routeCoords.length / totalSteps));
    
    setAnimatedCoords([routeCoords[0]]);
    
    const interval = setInterval(() => {
      currentFrame++;
      const nextIndex = currentFrame * stepSize;
      if (nextIndex >= routeCoords.length) {
        setAnimatedCoords(routeCoords);
        clearInterval(interval);
      } else {
        setAnimatedCoords(routeCoords.slice(0, nextIndex));
      }
    }, 15);

    return () => clearInterval(interval);
  }, [routeCoords]);

  const updateCenterAddress = async (customLat, customLng) => {
    let lat = customLat;
    let lng = customLng;
    if (lat === undefined || lng === undefined) {
      if (Platform.OS === 'web') {
        if (!mapInstanceRef.current) return;
        const center = mapInstanceRef.current.getCenter();
        lat = center.lat;
        lng = center.lng;
      } else {
        lat = mapCenterRef.current.lat;
        lng = mapCenterRef.current.lng;
      }
    }
    setCenterAddress('Manzil aniqlanmoqda...');

    try {
      const dbMatch = await api.reverseGeocode(lat, lng);
      if (dbMatch && dbMatch.success && dbMatch.match && dbMatch.place) {
        setCenterAddress(dbMatch.place.name);
        return;
      }
    } catch (dbErr) {
      console.warn("DB reverse geocoding failed", dbErr);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=uz,ru,en`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'InFastGo/1.0 (muham@users.noreply.github.com)'
        }
      });
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        let addressParts = [];
        const nameOfPlace = data.name || addr.amenity || addr.shop || addr.tourism || addr.office;
        if (nameOfPlace) addressParts.push(nameOfPlace);
        if (addr.house_number) addressParts.push(addr.house_number);
        if (addr.road) addressParts.push(addr.road);
        if (addr.neighbourhood) addressParts.push(addr.neighbourhood);
        else if (addr.suburb) addressParts.push(addr.suburb);
        if (addr.city) addressParts.push(addr.city);
        
        const cleanAddress = addressParts.join(', ') || data.display_name;
        setCenterAddress(cleanAddress);
        return;
      }
    } catch (err) {
      console.warn("Nominatim reverse geocoding failed", err);
    }

    try {
      const token = 'pk.eyJ1IjoieWFrdWJvdmRldiIsImEiOiJjbW1wNnprYWIwanlxMnBzZHg1ajFoeXowIn0' + '.' + 'mBQl5gkRN8abAbQhYrHPxA';
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=uz,ru`);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        setCenterAddress(data.features[0].place_name);
      } else {
        setCenterAddress(`Koordinata (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      }
    } catch (err) {
      setCenterAddress(`Koordinata (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    }
  };

  const handleConfirmLocation = () => {
    let lat, lng;
    if (Platform.OS === 'web') {
      if (!mapInstanceRef.current) return;
      const center = mapInstanceRef.current.getCenter();
      lat = center.lat;
      lng = center.lng;
    } else {
      lat = mapCenterRef.current.lat;
      lng = mapCenterRef.current.lng;
    }
    let addressName = centerAddress;
    if (addressName === 'Manzil yuklanmoqda...' || addressName === 'Manzil aniqlanmoqda...') {
      addressName = `Koordinata (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
    const customLoc = { id: `custom_${Date.now()}`, name: addressName, lat, lng };
    if (selectingType === 'pickup') setPickup(customLoc);
    else if (selectingType === 'destination') setDestination(customLoc);
    setIsMapSelecting(false);
    setSelectingType(null);
  };

  const calculateDistance = (loc1, loc2) => {
    const latDiff = Math.abs(loc1.lat - loc2.lat);
    const lngDiff = Math.abs(loc1.lng - loc2.lng);
    const rawDist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;
    return parseFloat(rawDist.toFixed(1));
  };

  const getFareEstimate = async () => {
    if (!destination) return;
    if (pickup.id === destination.id) {
      setError('Jo\'nash va borish manzillari bir xil bo\'lishi mumkin emas');
      setEstimate(null);
      return;
    }
    setError('');
    setEstimating(true);
    const distance = calculateDistance(pickup, destination);
    try {
      const response = await api.estimateFare(distance);
      if (response.success) setEstimate(response);
      else setError('Narxni hisoblash xatoligi');
    } catch (err) {
      setError(err.message || 'Narxni hisoblashda xatolik');
    } finally {
      setEstimating(false);
    }
  };

  useEffect(() => {
    if (destination) {
      getFareEstimate();
      setAcSelected(false);
      setLuggageSelected(false);
    } else {
      setEstimate(null);
    }
  }, [pickup, destination]);

  const handleRequestRide = async () => {
    if (!estimate || !estimate.estimates) return;
    setBooking(true);
    setError('');
    try {
      const pickupData = { lat: pickup.lat, lng: pickup.lng, address: pickup.name };
      const destData = { lat: destination.lat, lng: destination.lng, address: destination.name };
      const basePrice = estimate.estimates[selectedTariff] || 5000;
      const additionalFee = (acSelected ? 2000 : 0) + (luggageSelected ? 5000 : 0);
      const finalPrice = basePrice + additionalFee;
      const options = { ac: acSelected, luggage: luggageSelected, paymentMethod };
      
      const response = await api.requestRide(
        pickupData, 
        destData, 
        estimate.distance, 
        finalPrice, 
        selectedTariff, 
        options,
        paymentMethod,
        promoApplied ? promoApplied.code : null
      );
      if (response.success) {
        const rideData = { ...response.ride };
        if (response.paymentUrl) {
          rideData.paymentUrl = response.paymentUrl;
        }
        onRideCreated(rideData);
      } else {
        setError(response.message || 'Buyurtma berishda xatolik');
      }
    } catch (err) {
      setError(err.message || 'Kutilmagan xatolik yuz berdi');
    } finally {
      setBooking(false);
    }
  };

  // Mapbox setup for Web
  const mapInstanceRef = useRef(null);
  const mapCenterRef = useRef({ lat: pickup.lat, lng: pickup.lng });
  const pickupMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const arrivalMarkerRef = useRef(null);
  const selectingTypeRef = useRef(selectingType);

  useEffect(() => { selectingTypeRef.current = selectingType; }, [selectingType]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const initMap = async () => {
      if (!window.mapboxgl) {
        const link = document.createElement('link');
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js';
        await new Promise((resolve) => { script.onload = resolve; document.head.appendChild(script); });
      }
      window.mapboxgl.accessToken = 'pk.eyJ1IjoieWFrdWJvdmRldiIsImEiOiJjbW1wNnprYWIwanlxMnBzZHg1ajFoeXowIn0' + '.' + 'mBQl5gkRN8abAbQhYrHPxA';
      
      let initialCenter = [pickup.lng, pickup.lat];
      if (selectingType === 'destination' && destination) {
        initialCenter = [destination.lng, destination.lat];
      }

      const map = new window.mapboxgl.Map({
        container: 'mapbox-user-home-map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: initialCenter,
        zoom: isMapSelecting ? 16 : 12,
      });
      mapInstanceRef.current = map;

      map.on('moveend', () => {
        if (isMapSelectingRef.current) {
          updateCenterAddress();
        }
      });

      map.on('load', () => {
        if (isMapSelecting) {
          updateCenterAddress();
          return;
        }

        if (pickup) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:16px;background:linear-gradient(135deg,#3b32db,#1e1b4b);border:3px solid #fff;box-shadow:0 4px 15px rgba(59,50,219,0.3);font-weight:800;font-size:13px;color:#fff;">A</div>';
          pickupMarkerRef.current = new window.mapboxgl.Marker(el).setLngLat([pickup.lng, pickup.lat]).addTo(map);
        }

        if (destination) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:16px;background:linear-gradient(135deg,#EF4444,#DC2626);border:3px solid #fff;box-shadow:0 4px 15px rgba(239,68,68,0.4);font-weight:800;font-size:13px;color:#fff;">B</div>';
          destMarkerRef.current = new window.mapboxgl.Marker(el).setLngLat([destination.lng, destination.lat]).addTo(map);

          const arrEl = document.createElement('div');
          arrEl.innerHTML = '<div style="display:flex;align-items:center;background:#FFFFFF;color:#0F172A;padding:6px 12px;border-radius:20px;font-weight:bold;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);border:1px solid #E2E8F0;"><span style="margin-right:4px;">⏱️</span>12 min arrival</div>';
          arrivalMarkerRef.current = new window.mapboxgl.Marker(arrEl)
            .setLngLat([pickup.lng + 0.002, pickup.lat + 0.002])
            .addTo(map);

          const routeCoordsGeoJSON = routeCoords && routeCoords.length > 0
            ? routeCoords.map(c => [c.longitude, c.latitude])
            : [[pickup.lng, pickup.lat], [destination.lng, destination.lat]];

          map.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoordsGeoJSON } },
          });
          map.addLayer({
            id: 'route-glow', type: 'line', source: 'route',
            paint: { 'line-color': '#3b32db', 'line-width': 8, 'line-opacity': 0.12, 'line-blur': 8 },
          });
          map.addLayer({
            id: 'route', type: 'line', source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b32db', 'line-width': 3.5 },
          });
          const bounds = new window.mapboxgl.LngLatBounds()
            .extend([pickup.lng, pickup.lat])
            .extend([destination.lng, destination.lat]);
          map.fitBounds(bounds, { padding: 60 });
        }
      });
    };
    initMap();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [pickup, destination, selectingType, isMapSelecting, routeCoords]);

  const sheetTranslate = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={{ width: '100%', height: '100%', position: 'relative' }}>
            <View id="mapbox-user-home-map" style={{ width: '100%', height: '100%' }} />
            {isMapSelecting && (
              <>
                <View style={styles.centerPinContainer} pointerEvents="none">
                  <Text style={styles.centerPinIcon}>📍</Text>
                  <View style={[
                    styles.centerPinDot,
                    selectingType === 'pickup' ? { backgroundColor: '#10B981' } : { backgroundColor: '#EF4444' }
                  ]} />
                </View>

                <View style={styles.floatingAddressBanner}>
                  <Text style={[
                    styles.floatingAddressLabel,
                    selectingType === 'pickup' ? { color: '#10B981' } : { color: '#EF4444' }
                  ]}>
                    {selectingType === 'pickup' ? "🟢 JO'NASH MANZILI" : "🔴 BORISH MANZILI"}
                  </Text>
                  <Text style={styles.floatingAddressText} numberOfLines={2}>
                    {centerAddress}
                  </Text>
                </View>

                <View style={styles.floatingActionsRow}>
                  <TouchableOpacity
                    style={styles.floatingCancelButton}
                    onPress={() => {
                      setIsMapSelecting(false);
                      setSelectingType(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.floatingCancelText}>Orqaga</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.floatingConfirmButton,
                      { backgroundColor: '#3b32db' }
                    ]}
                    onPress={handleConfirmLocation}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.floatingConfirmText, { color: '#fff' }]}>
                      Tasdiqlash
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={{ width: '100%', height: '100%', position: 'relative' }}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: pickup ? pickup.lat : 41.311081,
                longitude: pickup ? pickup.lng : 69.240562,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onRegionChangeComplete={(region) => {
                if (isMapSelecting) {
                  updateCenterAddress(region.latitude, region.longitude);
                  mapCenterRef.current = { lat: region.latitude, lng: region.longitude };
                }
              }}
            >
              {!isMapSelecting && pickup && (
                <Marker
                  coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
                  title="Jo'nash"
                  description={pickup.name}
                >
                  <View style={[styles.pinPoint, styles.pickupPin, { position: 'relative', marginTop: 0, marginLeft: 0 }]}>
                    <Text style={styles.pinText}>A</Text>
                  </View>
                </Marker>
              )}
              {!isMapSelecting && destination && (
                <Marker
                  coordinate={{ latitude: destination.lat, longitude: destination.lng }}
                  title="Borish"
                  description={destination.name}
                >
                  <View style={[styles.pinPoint, styles.destPin, { position: 'relative', marginTop: 0, marginLeft: 0 }]}>
                    <Text style={styles.pinText}>B</Text>
                  </View>
                </Marker>
              )}

              {/* Arrival 12 min indicator on native */}
              {!isMapSelecting && pickup && destination && (
                <Marker
                  coordinate={{ latitude: pickup.lat + 0.002, longitude: pickup.lng + 0.002 }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.nativeArrivalMarker}>
                    <Text style={styles.nativeArrivalMarkerText}>⏱️ 12 min arrival</Text>
                  </View>
                </Marker>
              )}

              {!isMapSelecting && animatedCoords && animatedCoords.length > 0 && (
                <Polyline
                  coordinates={animatedCoords}
                  strokeColor="#3b32db"
                  strokeWidth={4}
                />
              )}
              
              {userLocation && (
                <>
                  <Circle
                    center={{ latitude: userLocation.lat, longitude: userLocation.lng }}
                    radius={50}
                    fillColor="rgba(59,50,219,0.08)"
                    strokeColor="rgba(59,50,219,0.2)"
                    strokeWidth={1}
                  />
                  <Marker
                    coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
                    title="Mening joylashuvim"
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.userLocMarkerOuter}>
                      <View style={styles.userLocMarkerInner} />
                    </View>
                  </Marker>
                </>
              )}
            </MapView>

            {isMapSelecting && (
              <>
                <View style={styles.centerPinContainer} pointerEvents="none">
                  <Text style={styles.centerPinIcon}>📍</Text>
                  <View style={[
                    styles.centerPinDot,
                    selectingType === 'pickup' ? { backgroundColor: '#10B981' } : { backgroundColor: '#EF4444' }
                  ]} />
                </View>

                <View style={styles.floatingAddressBanner}>
                  <Text style={[
                    styles.floatingAddressLabel,
                    selectingType === 'pickup' ? { color: '#10B981' } : { color: '#EF4444' }
                  ]}>
                    {selectingType === 'pickup' ? "🟢 JO'NASH MANZILI" : "🔴 BORISH MANZILI"}
                  </Text>
                  <Text style={styles.floatingAddressText} numberOfLines={2}>
                    {centerAddress}
                  </Text>
                </View>

                <View style={styles.floatingActionsRow}>
                  <TouchableOpacity
                    style={styles.floatingCancelButton}
                    onPress={() => {
                      setIsMapSelecting(false);
                      setSelectingType(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.floatingCancelText}>Orqaga</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.floatingConfirmButton,
                      { backgroundColor: '#3b32db' }
                    ]}
                    onPress={handleConfirmLocation}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.floatingConfirmText, { color: '#fff' }]}>
                      Tasdiqlash
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* Dynamic Header Bar */}
        {!selectingType && (
          destination ? (
            /* "Your Route" header when destination is chosen (Screen 5 style) */
            <View style={[styles.mapHeader, { top: Math.max(insets?.top || 0, 16) }]}>
              <View style={styles.userInfo}>
                <TouchableOpacity 
                  style={styles.menuButton} 
                  onPress={() => {
                    setDestination(null);
                    setEstimate(null);
                  }} 
                  activeOpacity={0.7}
                >
                  <Feather name="arrow-left" size={24} color="#3b32db" />
                </TouchableOpacity>
                <Text style={styles.headerTitleText}>Yo'nalish</Text>
              </View>
            </View>
          ) : (
            /* Normal Home Header */
            <View style={[styles.mapHeader, { top: Math.max(insets?.top || 0, 16) }]}>
              <View style={styles.userInfo}>
                <TouchableOpacity 
                  style={styles.menuButton} 
                  onPress={() => setShowSidebar(true)}
                  activeOpacity={0.7}
                >
                  <Feather name="menu" size={24} color="#3b32db" />
                </TouchableOpacity>
                <Text style={styles.headerTitleText}>InFast Go</Text>
              </View>
              <TouchableOpacity onPress={onViewProfile} activeOpacity={0.8}>
                <Image
                  source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
                  style={styles.headerAvatar}
                />
              </TouchableOpacity>
            </View>
          )
        )}

        {/* My Location Button */}
        {!isMapSelecting && !selectingType && !destination && (
          <TouchableOpacity
            style={[styles.myLocationBtn, { top: Math.max((insets?.top || 0) + 70, 110) }]}
            onPress={handleGetUserLocation}
            activeOpacity={0.8}
          >
            {locatingUser ? (
              <ActivityIndicator size="small" color="#3b32db" />
            ) : (
              <Feather name="navigation" size={20} color="#3b32db" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Sheet */}
      {!isMapSelecting && (
        selectingType ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidSearch}
          >
            <Animated.View style={[
              styles.bottomSheet,
              { transform: [{ translateY: sheetTranslate }] },
              { height: '100%', maxHeight: '100%', paddingTop: Math.max(insets?.top || 0, 10) }
            ]}>
              <TouchableOpacity
                style={styles.dragHandleRow}
                onPress={Keyboard.dismiss}
                activeOpacity={1}
              >
                <View style={styles.dragHandle} />
              </TouchableOpacity>

              {/* Location Picker */}
              <View style={styles.selectionView}>
                <View style={styles.selectionHeader}>
                  <Text style={styles.selectionTitle}>
                    {selectingType === 'pickup' ? 'Jo\'nash manzilini tanlang' : 'Borish manzilini tanlang'}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectingType(null);
                    }}
                    activeOpacity={0.6}
                  >
                    <Feather name="x" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View style={styles.searchBarContainer}>
                  <Feather name="search" size={16} color="#3b32db" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Manzil yoki joy nomini kiriting..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus={true}
                  />
                  {searching ? (
                    <ActivityIndicator size="small" color="#3b32db" style={{ marginRight: 8 }} />
                  ) : null}
                  {searchQuery ? (
                    <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery('')}>
                      <Feather name="x" size={14} color="#64748B" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <ScrollView
                  style={styles.locationsList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  <TouchableOpacity
                    style={[
                      styles.mapSelectTrigger,
                      selectingType === 'pickup'
                        ? { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }
                        : { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsMapSelecting(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.mapSelectTriggerIconContainer,
                      selectingType === 'pickup'
                        ? { backgroundColor: 'rgba(16,185,129,0.15)' }
                        : { backgroundColor: 'rgba(239,68,68,0.15)' }
                    ]}>
                      <Feather
                        name="map"
                        size={18}
                        color={selectingType === 'pickup' ? '#10B981' : '#EF4444'}
                      />
                    </View>
                    <Text style={[
                      styles.mapSelectTriggerText,
                      selectingType === 'pickup' ? { color: '#10B981' } : { color: '#EF4444' }
                    ]}>
                      Karta orqali belgilash
                    </Text>
                  </TouchableOpacity>

                  {searching && searchResults.length === 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#3b32db" />
                    </View>
                  ) : (searchQuery ? searchResults : PREDEFINED_LOCATIONS).map((loc) => (
                    <TouchableOpacity
                      key={loc.id}
                      style={styles.locationItem}
                      onPress={() => {
                        Keyboard.dismiss();
                        if (selectingType === 'pickup') setPickup(loc);
                        else setDestination(loc);
                        setSelectingType(null);
                      }}
                      activeOpacity={0.6}
                    >
                      <View style={styles.locIcon}>
                        <Feather name="map-pin" size={16} color="#3b32db" />
                      </View>
                      <View style={styles.locInfo}>
                        <Text style={styles.locationName}>{loc.name}</Text>
                        {loc.address ? (
                          <Text style={styles.locationAddress} numberOfLines={1}>{loc.address}</Text>
                        ) : null}
                        <Text style={styles.locationCoords}>
                          {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                        </Text>
                      </View>
                      <Feather name="arrow-right" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                  ))}

                  {searchQuery && !searching && searchResults.length === 0 ? (
                    <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                      <Text style={{ color: '#64748B', fontSize: 14 }}>Hech narsa topilmadi</Text>
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.keyboardAvoid}>
            <Animated.View style={[
              styles.bottomSheet,
              { transform: [{ translateY: sheetTranslate }] },
              destination && { paddingBottom: Math.max(insets?.bottom || 0, 16) }
            ]}>
              <TouchableOpacity
                style={styles.dragHandleRow}
                onPress={Keyboard.dismiss}
                activeOpacity={1}
              >
                <View style={styles.dragHandle} />
              </TouchableOpacity>

              {destination ? (
                /* SCREEN 5: Route preview and tariff selection sheet */
                <Animated.View style={[styles.bookingView, { opacity: fadeAnim }]}>
                  {estimating ? (
                    <View style={styles.priceContainer}>
                      <ActivityIndicator color="#3b32db" size="small" />
                      <Text style={styles.calculatingText}>Narx va yo'nalish hisoblanmoqda...</Text>
                    </View>
                  ) : estimate ? (
                    <View>
                      {/* Travel details estimate header */}
                      <View style={styles.estimateDetailsHeader}>
                        <Text style={styles.estimateTitleText}>
                          Sayohat masofasi: {estimate.distance} km • ~{Math.round(estimate.distance * 1.8) + 2} min
                        </Text>
                        <TouchableOpacity style={styles.shareRouteButton} activeOpacity={0.7}>
                          <Feather name="share-2" size={16} color="#3b32db" />
                        </TouchableOpacity>
                      </View>

                      {/* Vertical Tariff Selection List styled exactly as Screen 5 */}
                      <View style={styles.verticalTariffsList}>
                        {[
                          { 
                            id: 'standart', 
                            name: 'Standart', 
                            desc: 'Hamyonbop va tezkor kundalik sayohatlar', 
                            iconBg: '#EEF2FF', 
                            iconColor: '#3b32db', 
                            iconName: 'navigation', 
                            time: `${Math.max(Math.round(estimate.distance * 0.8), 2)} daq` 
                          },
                          { 
                            id: 'komfort', 
                            name: 'Komfort', 
                            desc: 'Yangi va shinam avtomobillar, qulay sayohat', 
                            iconBg: '#EEF0FF', 
                            iconColor: '#3b32db', 
                            iconName: 'star', 
                            time: `${Math.max(Math.round(estimate.distance * 0.6), 3)} daq` 
                          },
                          { 
                            id: 'biznes', 
                            name: 'Biznes', 
                            desc: 'Premium toifadagi avtomobillar va tajribali haydovchilar', 
                            iconBg: '#F1F5F9', 
                            iconColor: '#0F172A', 
                            iconName: 'award', 
                            time: `${Math.max(Math.round(estimate.distance * 0.5), 1)} daq` 
                          },
                        ].map((item) => {
                          const basePrice = estimate.estimates[item.id] || 0;
                          const displayPrice = basePrice + (acSelected ? 2000 : 0) + (luggageSelected ? 5000 : 0);
                          const isSelected = selectedTariff === item.id;
                          
                          return (
                            <TouchableOpacity
                              key={item.id}
                              style={[
                                styles.verticalTariffRow,
                                isSelected && styles.verticalTariffRowActive
                              ]}
                              onPress={() => setSelectedTariff(item.id)}
                              activeOpacity={0.8}
                            >
                              <View style={[styles.verticalTariffIconBg, { backgroundColor: item.iconBg }]}>
                                <Feather name={item.iconName} size={16} color={item.iconColor} />
                              </View>

                              <View style={styles.verticalTariffMainInfo}>
                                <Text style={styles.verticalTariffName}>{item.name}</Text>
                                <Text style={styles.verticalTariffDesc}>{item.desc}</Text>
                              </View>

                              <View style={styles.verticalTariffPriceInfo}>
                                <Text style={styles.verticalTariffPrice}>
                                  {displayPrice.toLocaleString()} UZS
                                </Text>
                                <Text style={styles.verticalTariffTime}>{item.time}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Payment method block */}
                      <View style={styles.paymentMethodRow}>
                        <View style={styles.paymentMethodInfo}>
                          <View style={styles.paymentIconBg}>
                            {paymentMethod === 'cash' ? (
                              <Feather name="dollar-sign" size={16} color="#10B981" />
                            ) : (
                              <Feather name="credit-card" size={16} color="#3b32db" />
                            )}
                          </View>
                          <Text style={styles.paymentMethodText}>
                            {paymentMethod === 'cash' ? "Naqd pul (Cash)" : "Click (To'lov)"}
                          </Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.paymentChangeButton} 
                          onPress={() => setShowPaymentPicker(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.paymentChangeText}>O'zgartirish</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Promo Code Section */}
                      <View style={styles.promoSection}>
                        {promoApplied ? (
                          <View style={styles.promoAppliedRow}>
                            <View style={styles.promoAppliedBadge}>
                              <Feather name="tag" size={14} color="#10B981" style={{ marginRight: 6 }} />
                              <Text style={styles.promoAppliedText}>
                                {promoApplied.code} — {promoApplied.discount}% chegirma qo'llanildi
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                setPromoApplied(null);
                                setPromoInput('');
                                setPromoVisible(false);
                                setPromoError('');
                              }}
                              activeOpacity={0.7}
                            >
                              <Feather name="x" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.promoToggleBtn}
                              onPress={() => {
                                setPromoVisible(v => !v);
                                setPromoError('');
                              }}
                              activeOpacity={0.7}
                            >
                              <Feather name="tag" size={14} color="#3b32db" style={{ marginRight: 6 }} />
                              <Text style={styles.promoToggleText}>Promokod bormi?</Text>
                              <Feather
                                name={promoVisible ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color="#3b32db"
                                style={{ marginLeft: 'auto' }}
                              />
                            </TouchableOpacity>

                            {promoVisible && (
                              <View style={styles.promoInputRow}>
                                <TextInput
                                  style={styles.promoTextInput}
                                  placeholder="Kodni kiriting (masalan: INFAST20)"
                                  placeholderTextColor="#94A3B8"
                                  value={promoInput}
                                  onChangeText={t => {
                                    setPromoInput(t.toUpperCase());
                                    setPromoError('');
                                  }}
                                  autoCapitalize="characters"
                                  returnKeyType="done"
                                />
                                <TouchableOpacity
                                  style={[
                                    styles.promoApplyBtn,
                                    (!promoInput.trim() || promoLoading) && { opacity: 0.5 },
                                  ]}
                                  disabled={!promoInput.trim() || promoLoading}
                                  activeOpacity={0.8}
                                  onPress={async () => {
                                    setPromoLoading(true);
                                    setPromoError('');
                                    try {
                                      const res = await api.validatePromoCode(promoInput.trim(), 'taxi');
                                      if (res.success) {
                                        setPromoApplied({ code: res.code, discount: res.discount });
                                        setPromoVisible(false);
                                      }
                                    } catch (e) {
                                      setPromoError(e.message || 'Noto\'g\'ri promokod');
                                    } finally {
                                      setPromoLoading(false);
                                    }
                                  }}
                                >
                                  {promoLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                  ) : (
                                    <Text style={styles.promoApplyBtnText}>Qo'llash</Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            )}

                            {promoError ? (
                              <Text style={styles.promoErrorText}>{promoError}</Text>
                            ) : null}
                          </>
                        )}
                      </View>

                      {error ? <Text style={styles.errorText}>{error}</Text> : null}

                      {/* Confirm Ride Button */}
                      <TouchableOpacity
                        style={[styles.bookButton, booking && styles.bookButtonDisabled]}
                        onPress={handleRequestRide}
                        disabled={booking}
                        activeOpacity={0.8}
                      >
                        {booking ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Text style={styles.bookButtonText}>
                              Tasdiqlash va sayohatni boshlash
                            </Text>
                            <Feather name="arrow-right" size={18} color="#fff" style={{ marginLeft: 8 }} />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </Animated.View>
              ) : (
                /* DEFAULT STATE: main booking view with search pill and tab bar */
                <Animated.View style={[styles.bookingView, { opacity: fadeAnim }]}>
                  {/* Search field styled exactly as 'Qayerga boramiz?' pill input */}
                  <TouchableOpacity 
                    style={styles.searchPillButton} 
                    onPress={() => setSelectingType('destination')} 
                    activeOpacity={0.9}
                  >
                    <Feather name="search" size={20} color="#3b32db" style={{ marginRight: 12 }} />
                    <Text style={styles.searchPillText}>Qayerga boramiz?</Text>
                  </TouchableOpacity>

                  {/* Current Location row card styled exactly as screenshot */}
                  <View style={styles.currentLocationCard}>
                    <View style={styles.greenLocationDot} />
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.locationSectionLabel}>HOZIRGI JOYLASHUV</Text>
                      <Text style={styles.locationNameText} numberOfLines={1}>
                        {pickup.name}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.changePickupButton} 
                      onPress={() => setSelectingType('pickup')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.changePickupText}>O'zgartirish</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bottom Tab Navigation Bar with SAFE AREA padding */}
                  <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets?.bottom || 0, 12) }]}>
                    <TouchableOpacity style={styles.tabItem} activeOpacity={0.8}>
                      <View style={styles.activeTabPill}>
                        <Feather name="home" size={20} color="#FFFFFF" />
                      </View>
                      <Text style={styles.activeTabLabel}>Bosh sahifa</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.tabItem} onPress={onViewHistory} activeOpacity={0.8}>
                      <View style={styles.inactiveTabIcon}>
                        <Feather name="clock" size={20} color="#64748B" />
                      </View>
                      <Text style={styles.inactiveTabLabel}>Sayohatlar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.tabItem} onPress={onViewProfile} activeOpacity={0.8}>
                      <View style={styles.inactiveTabIcon}>
                        <Feather name="user" size={20} color="#64748B" />
                      </View>
                      <Text style={styles.inactiveTabLabel}>Profil</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          </View>
        )
      )}

      {/* Payment Method Picker Modal */}
      <Modal
        visible={showPaymentPicker}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowPaymentPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowPaymentPicker(false)}>
            <View style={styles.modalBackgroundDismiss} />
          </TouchableWithoutFeedback>
          <View style={[styles.paymentPickerCard, { paddingBottom: Math.max(insets?.bottom || 0, 20) }]}>
            <View style={styles.modalDragHandle} />
            
            <Text style={styles.modalTitleText}>To'lov usulini tanlang</Text>
            
            {/* Cash option */}
            <TouchableOpacity
              style={[
                styles.paymentOptionRow,
                paymentMethod === 'cash' && styles.paymentOptionRowActive
              ]}
              onPress={() => {
                setPaymentMethod('cash');
                setShowPaymentPicker(false);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.paymentOptionIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                <Feather name="dollar-sign" size={18} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentOptionName}>Naqd pul (Cash)</Text>
                <Text style={styles.paymentOptionDesc}>Sayohat tugagach haydovchiga to'lanadi</Text>
              </View>
              {paymentMethod === 'cash' ? (
                <View style={styles.paymentSelectedCheck}>
                  <Feather name="check" size={14} color="#FFFFFF" />
                </View>
              ) : (
                <View style={styles.paymentUnselectedCircle} />
              )}
            </TouchableOpacity>

            {/* Click option - disabled/tez kunda */}
            <View
              style={[
                styles.paymentOptionRow,
                styles.paymentOptionRowDisabled
              ]}
            >
              <View style={[styles.paymentOptionIconBg, { backgroundColor: 'rgba(59, 50, 219, 0.08)' }]}>
                <Feather name="credit-card" size={18} color="#3b32db" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.paymentOptionName, { color: '#94A3B8' }]}>Click</Text>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>Tez kunda</Text>
                  </View>
                </View>
                <Text style={[styles.paymentOptionDesc, { color: '#CBD5E1' }]}>Click to'lov tizimi orqali to'lov</Text>
              </View>
              <View style={styles.paymentUnselectedCircle} />
            </View>

            {/* Payme option - disabled/tez kunda */}
            <View
              style={[
                styles.paymentOptionRow,
                styles.paymentOptionRowDisabled
              ]}
            >
              <View style={[styles.paymentOptionIconBg, { backgroundColor: 'rgba(14, 165, 233, 0.08)' }]}>
                <Feather name="credit-card" size={18} color="#0EA5E9" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.paymentOptionName, { color: '#94A3B8' }]}>Payme</Text>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>Tez kunda</Text>
                  </View>
                </View>
                <Text style={[styles.paymentOptionDesc, { color: '#CBD5E1' }]}>Payme to'lov tizimi orqali to'lov</Text>
              </View>
              <View style={styles.paymentUnselectedCircle} />
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowPaymentPicker(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeModalButtonText}>Yopish</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sidebar Drawer Modal */}
      <Modal
        visible={showSidebar}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowSidebar(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSidebar(false)}>
          <View style={styles.sidebarOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.sidebarCard, { paddingTop: Math.max(insets?.top || 0, 24) }]}>
                <View style={styles.sidebarHeader}>
                  <Text style={styles.sidebarTitle}>InFast Go Menu</Text>
                  <TouchableOpacity onPress={() => setShowSidebar(false)} style={styles.sidebarCloseBtn}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
                
                {/* User Info Section */}
                <View style={styles.sidebarUserBox}>
                  <View style={styles.sidebarUserAvatar}>
                    <Text style={styles.sidebarUserAvatarText}>
                      {user?.name ? user.name[0].toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <View style={styles.sidebarUserDetails}>
                    <Text style={styles.sidebarUserName}>{user?.name} {user?.surname || ''}</Text>
                    <Text style={styles.sidebarUserPhone}>{user?.phone || ''}</Text>
                  </View>
                </View>

                <View style={styles.sidebarMenu}>
                  {/* Switch Services */}
                  <TouchableOpacity
                    style={styles.sidebarMenuItem}
                    onPress={() => {
                      setShowSidebar(false);
                      onViewServices();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sidebarMenuIconBg, { backgroundColor: 'rgba(59, 50, 219, 0.08)' }]}>
                      <Feather name="grid" size={18} color="#3b32db" />
                    </View>
                    <Text style={styles.sidebarMenuItemText}>Xizmatlar sahifasi</Text>
                  </TouchableOpacity>

                  {/* Sayohatlar tarixi */}
                  <TouchableOpacity
                    style={styles.sidebarMenuItem}
                    onPress={() => {
                      setShowSidebar(false);
                      onViewHistory();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sidebarMenuIconBg, { backgroundColor: 'rgba(59, 50, 219, 0.08)' }]}>
                      <Feather name="clock" size={18} color="#3b32db" />
                    </View>
                    <Text style={styles.sidebarMenuItemText}>Sayohatlar tarixi</Text>
                  </TouchableOpacity>

                  {/* Profil sozlamalari */}
                  <TouchableOpacity
                    style={styles.sidebarMenuItem}
                    onPress={() => {
                      setShowSidebar(false);
                      onViewProfile();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sidebarMenuIconBg, { backgroundColor: 'rgba(59, 50, 219, 0.08)' }]}>
                      <Feather name="user" size={18} color="#3b32db" />
                    </View>
                    <Text style={styles.sidebarMenuItemText}>Profilni sozlash</Text>
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={styles.sidebarDivider} />

                  {/* Tizimdan chiqish */}
                  <TouchableOpacity
                    style={[styles.sidebarMenuItem, { marginTop: 'auto', marginBottom: 20 }]}
                    onPress={() => {
                      setShowSidebar(false);
                      onLogout();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sidebarMenuIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
                      <Feather name="log-out" size={18} color="#EF4444" />
                    </View>
                    <Text style={[styles.sidebarMenuItemText, { color: '#EF4444' }]}>Tizimdan chiqish</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  pinPoint: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginLeft: -16, marginTop: -16,
  },
  pickupPin: { backgroundColor: '#3b32db', borderWidth: 2.5, borderColor: '#fff' },
  destPin: { backgroundColor: '#EF4444', borderWidth: 2.5, borderColor: '#fff' },
  pinText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Arrival Marker Tag on Map
  nativeArrivalMarker: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  nativeArrivalMarkerText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },

  // Map Header: Light translucent design matching screenshot
  mapHeader: {
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 50 : 35, 
    left: 16, 
    right: 16,
    backgroundColor: 'rgba(235, 237, 248, 0.92)',
    borderRadius: 24, 
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, 
    shadowRadius: 12,
    elevation: 6,
    zIndex: 100,
  },
  userInfo: {
    flexDirection: 'row', 
    alignItems: 'center',
  },
  menuButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitleText: {
    color: '#1E1B4B', 
    fontSize: 19, 
    fontWeight: '800',
  },
  headerAvatar: {
    width: 36, 
    height: 36, 
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },

  // Center Pin Overlay for selection
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 60,
    height: 60,
    marginTop: -46,
    marginLeft: -30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  centerPinIcon: {
    fontSize: 34,
  },
  centerPinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: -4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },

  // Floating Address Banner
  floatingAddressBanner: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    zIndex: 100,
  },
  floatingAddressLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  floatingAddressText: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Floating Actions Row
  floatingActionsRow: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  floatingCancelButton: {
    flex: 1,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingCancelText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  floatingConfirmButton: {
    flex: 2,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingConfirmText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Map Select Trigger
  mapSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1.5,
  },
  mapSelectTriggerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mapSelectTriggerText: {
    fontSize: 15,
    fontWeight: '700',
  },

  keyboardAvoid: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  keyboardAvoidSearch: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  // Bottom Sheet: Redesigned as clean oq panel with rounded corners
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36, 
    borderTopRightRadius: 36,
    paddingHorizontal: 20, 
    paddingBottom: Platform.OS === 'ios' ? 14 : 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandleRow: {
    alignItems: 'center', 
    paddingVertical: 12,
  },
  dragHandle: {
    width: 44, 
    height: 4.5, 
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },

  // Booking View
  bookingView: {
    flex: 1, 
    justifyContent: 'space-between',
  },

  // Search Pill Button: styled like "Qayerga boramiz?" input box in screenshot
  searchPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF1FF',
    borderRadius: 25,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 14,
  },
  searchPillText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },

  // Current Location Card styled matching screenshot 
  currentLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#EEF0F8',
    marginBottom: 16,
  },
  greenLocationDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationSectionLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  locationNameText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  changePickupButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changePickupText: {
    color: '#3b32db',
    fontSize: 14,
    fontWeight: '700',
  },

  // Travel details estimate header (Screen 5 style)
  estimateDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  estimateTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  shareRouteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Vertical Tariff Selector styled exactly as Screen 5
  verticalTariffsList: {
    marginBottom: 16,
  },
  verticalTariffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#EEF2FF',
    padding: 12,
    marginBottom: 10,
  },
  verticalTariffRowActive: {
    borderColor: '#3b32db',
    backgroundColor: '#EEF0FF',
  },
  verticalTariffIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  verticalTariffMainInfo: {
    flex: 1,
  },
  verticalTariffName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  verticalTariffDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  verticalTariffPriceInfo: {
    alignItems: 'flex-end',
  },
  verticalTariffPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  verticalTariffTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },

  // Payment method row
  paymentMethodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(59,50,219,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  paymentMethodText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  paymentChangeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  paymentChangeText: {
    color: '#3b32db',
    fontSize: 13,
    fontWeight: '800',
  },

  // Price estimate loading block
  priceContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 14,
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  calculatingText: {
    color: '#64748B', 
    marginLeft: 10, 
    fontSize: 13,
    fontWeight: '600',
  },

  errorText: {
    color: '#EF4444', 
    textAlign: 'center', 
    fontSize: 13, 
    marginBottom: 10,
    fontWeight: '600',
  },

  // Book Button: Styled with indigo theme
  bookButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#3b32db', 
    borderRadius: 20, 
    paddingVertical: 15,
    shadowColor: '#3b32db', 
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, 
    shadowRadius: 12, 
    elevation: 6,
    marginBottom: 8,
  },
  bookButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  bookButtonText: {
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '700',
  },

  // Selection View
  selectionView: {
    flex: 1,
  },
  selectionHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 16,
  },
  selectionTitle: {
    color: '#0F172A', 
    fontSize: 18, 
    fontWeight: '700',
  },
  closeBtn: {
    width: 32, 
    height: 32, 
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', 
    justifyContent: 'center',
  },
  locationsList: {
    flex: 1,
  },
  locationItem: {
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: 14, 
    paddingHorizontal: 4,
    borderBottomWidth: 1, 
    borderColor: '#F1F5F9',
  },
  locIcon: {
    width: 36, 
    height: 36, 
    borderRadius: 10,
    backgroundColor: '#EEF1FF',
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 12,
  },
  locInfo: { 
    flex: 1 
  },
  locationName: {
    color: '#0F172A', 
    fontSize: 15, 
    fontWeight: '600',
  },
  locationCoords: {
    color: '#94A3B8', 
    fontSize: 11, 
    marginTop: 2,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchBarInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    padding: 0,
    height: 24,
  },
  clearSearchBtn: {
    padding: 4,
  },
  locationAddress: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 2,
  },

  // My Location Button
  myLocationBtn: {
    position: 'absolute',
    top: 120,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(59,50,219,0.15)',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 50,
  },

  // User Location Marker
  userLocMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59,50,219,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(59,50,219,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userLocMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b32db',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },

  // Bottom Navigation Bar with SAFE AREA padding
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#EEF0F8',
    paddingTop: 10,
    paddingBottom: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 10,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  activeTabPill: {
    backgroundColor: '#3b32db',
    width: 58,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  inactiveTabIcon: {
    width: 58,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeTabLabel: {
    color: '#3b32db',
    fontSize: 12,
    fontWeight: '700',
  },
  inactiveTabLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal Overlay / Payment Picker Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  paymentPickerCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  modalDragHandle: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 20,
    textAlign: 'center',
  },
  paymentOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF0F8',
    marginBottom: 12,
  },
  paymentOptionRowActive: {
    borderColor: '#3b32db',
    backgroundColor: 'rgba(59, 50, 219, 0.02)',
  },
  paymentOptionRowDisabled: {
    opacity: 0.65,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  paymentOptionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentOptionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  paymentOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  paymentSelectedCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b32db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentUnselectedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  comingSoonBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  closeModalButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  closeModalButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackgroundDismiss: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-start',
    flexDirection: 'row',
  },
  sidebarCard: {
    width: '75%',
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    paddingHorizontal: 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#EEF0F8',
    marginBottom: 20,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sidebarCloseBtn: {
    padding: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  sidebarUserBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EEF0F8',
  },
  sidebarUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 50, 219, 0.15)',
  },
  sidebarUserAvatarText: {
    color: '#3b32db',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sidebarUserDetails: {
    flex: 1,
  },
  sidebarUserName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sidebarUserPhone: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sidebarMenu: {
    flex: 1,
  },
  sidebarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  sidebarMenuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sidebarMenuItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: '#EEF0F8',
    marginVertical: 16,
  },
  comingSoonContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  comingSoonMainText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  comingSoonSubText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ===== PROMO CODE STYLES =====
  promoSection: {
    marginBottom: 12,
  },
  promoToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 50, 219, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 50, 219, 0.12)',
  },
  promoToggleText: {
    fontSize: 13,
    color: '#3b32db',
    fontWeight: '700',
    flex: 1,
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  promoTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 1,
  },
  promoApplyBtn: {
    backgroundColor: '#3b32db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoApplyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  promoAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  promoAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  promoAppliedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    flex: 1,
  },
  promoErrorText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },
});
