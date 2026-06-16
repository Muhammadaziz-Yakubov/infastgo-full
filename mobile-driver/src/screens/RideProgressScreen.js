import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  PanResponder,
  Dimensions,
  Linking,
} from 'react-native';
import { api } from '../services/api';
import { emitLocation } from '../services/socket';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';

const lightMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#F8FAFC" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#64748B" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#FFFFFF" }]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#F1F5F9" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#475569" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#FFFFFF" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [{ "color": "#E2E8F0" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#CBD5E1" }]
  },
  {
    "featureType": "road.local",
    "elementType": "labels",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#E0F2FE" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#0284C7" }]
  }
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_TRACK_WIDTH = SCREEN_WIDTH - 80;
const SWIPE_THUMB_SIZE = 56;
const SWIPE_THRESHOLD = 0.75;

// ─── Custom Swipe Button Component ───
function SwipeButton({ label, color, textColor, onSwipeComplete, disabled }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const maxSwipe = SWIPE_TRACK_WIDTH - SWIPE_THUMB_SIZE - 8;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        const newX = Math.max(0, Math.min(gestureState.dx, maxSwipe));
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipePercent = gestureState.dx / maxSwipe;
        if (swipePercent >= SWIPE_THRESHOLD) {
          Animated.spring(translateX, {
            toValue: maxSwipe,
            useNativeDriver: true,
            tension: 40,
            friction: 6,
          }).start(() => {
            if (onSwipeComplete) onSwipeComplete();
            setTimeout(() => {
              translateX.setValue(0);
            }, 400);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const opacity = translateX.interpolate({
    inputRange: [0, maxSwipe * 0.5, maxSwipe],
    outputRange: [1, 0.4, 0],
  });

  const arrowOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.8, 0.3],
  });

  return (
    <View style={[swipeStyles.track, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
      {/* Label with fade out */}
      <Animated.View style={[swipeStyles.labelContainer, { opacity }]}>
        <Animated.Text style={[swipeStyles.arrowHints, { opacity: arrowOpacity, color: color }]}>
          ›››
        </Animated.Text>
        <Text style={[swipeStyles.label, { color: '#334155' }]}>{label}</Text>
      </Animated.View>

      {/* Swipe thumb */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          swipeStyles.thumb,
          {
            backgroundColor: color,
            transform: [{ translateX }],
          },
        ]}
      >
        <Text style={[swipeStyles.thumbIcon, { color: '#FFFFFF' }]}>→</Text>
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  track: {
    height: SWIPE_THUMB_SIZE + 8,
    borderRadius: (SWIPE_THUMB_SIZE + 8) / 2,
    borderWidth: 1.5,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  labelContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  arrowHints: {
    fontSize: 18,
    marginRight: 8,
    color: '#fff',
    fontWeight: '300',
    letterSpacing: -2,
  },
  thumb: {
    width: SWIPE_THUMB_SIZE,
    height: SWIPE_THUMB_SIZE,
    borderRadius: SWIPE_THUMB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  thumbIcon: {
    fontSize: 22,
    fontWeight: 'bold',
  },
});

// ─── Pulsing Dot Component ───
function PulsingDot({ color, size = 8 }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.8, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: size * 2.5, height: size * 2.5, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ scale: pulseAnim }],
        opacity: pulseAnim.interpolate({ inputRange: [1, 1.8], outputRange: [1, 0.3] }),
        position: 'absolute',
      }} />
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }} />
    </View>
  );
}

// ─── Main Screen ───
export default function RideProgressScreen({ initialRide, driver, onRideFinished }) {
  const [ride, setRide] = useState(initialRide);
  const [loading, setLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState({
    latitude: driver.currentLocation?.lat || 41.311081,
    longitude: driver.currentLocation?.lng || 69.240562,
  });
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState({ distance: null, duration: null });
  const [error, setError] = useState('');
  const locationWatcherRef = useRef(null);
  const lastFetchedLocationRef = useRef(null);
  const lastFetchedStatusRef = useRef(null);
  const mapRef = useRef(null);

  // Real-time timers & speed states
  const [etaSeconds, setEtaSeconds] = useState(360); 
  const [waitSeconds, setWaitSeconds] = useState(180); 
  const [tripSeconds, setTripSeconds] = useState(840); 
  const [speed, setSpeed] = useState(0);
  const [speedLimit, setSpeedLimit] = useState(50);
  const [heading, setHeading] = useState(0);
  const [isTracking, setIsTracking] = useState(true);

  const isTrackingRef = useRef(isTracking);
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  };

  // Formatting helpers
  const formatCountdown = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) {
      return `${mins} daq ${secs} son`;
    }
    return `${secs} soniya`;
  };

  const getETAClockTime = (secondsLeft) => {
    const now = new Date();
    now.setSeconds(now.getSeconds() + secondsLeft);
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const getNavigationInstruction = () => {
    if (routeInfo.distance === null) {
      return {
        instruction: "Yo'nalish hisoblanmoqda...",
        subInstruction: "Iltimos, kuting",
        icon: "navigation",
        voice: "Yo'nalish aniqlanmoqda..."
      };
    }

    const dist = routeInfo.distance;
    const street = ride.status === 'started' 
      ? (ride.destination?.address?.split(',')[0] || "Manzil") 
      : (ride.pickup?.address?.split(',')[0] || "Mijoz manzili");

    if (ride.status === 'arriving') {
      return {
        instruction: "Mijoz kutish joyidasiz",
        subInstruction: "Mijoz chiqishini kuting",
        icon: "check-circle",
        voice: "Mijoz kutish joyiga yetib keldingiz. Mijozni kuting."
      };
    }

    if (dist < 100) {
      return {
        instruction: ride.status === 'started' ? "Belgilangan manzilga yetib keldingiz" : "Mijoz kutish joyiga yetib keldingiz",
        subInstruction: street,
        icon: "check-circle",
        voice: ride.status === 'started' ? "Manzilga yetib keldingiz. Sayohatni yakunlashingiz mumkin." : "Mijoz kutish joyiga yetib keldingiz."
      };
    } else if (dist < 300) {
      return {
        instruction: `Chapga buriling (200m)`,
        subInstruction: `${street} ko'chasiga`,
        icon: "arrow-left",
        voice: `200 metrdan keyin ${street} ko'chasiga chapga buriling`
      };
    } else if (dist < 700) {
      return {
        instruction: `O'ngga buriling (500m)`,
        subInstruction: `${street} ko'chasiga`,
        icon: "arrow-right",
        voice: `500 metrdan keyin ${street} ko'chasiga o'ngga buriling`
      };
    } else {
      return {
        instruction: `To'g'riga davom eting (${formatDistance(dist)})`,
        subInstruction: `${street} ko'chasiga`,
        icon: "arrow-up",
        voice: `${formatDistance(dist)} to'g'riga harakatlaning`
      };
    }
  };

  // Sync timers with API route duration when fetched
  useEffect(() => {
    if (routeInfo.duration) {
      if (ride.status === 'accepted') {
        setEtaSeconds(Math.round(routeInfo.duration));
      } else if (ride.status === 'started') {
        setTripSeconds(Math.round(routeInfo.duration));
      }
    }
  }, [routeInfo.duration, ride.status]);

  // Real-time decrement of timers
  useEffect(() => {
    const interval = setInterval(() => {
      if (ride.status === 'accepted') {
        setEtaSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (ride.status === 'arriving') {
        setWaitSeconds((prev) => prev - 1);
      } else if (ride.status === 'started') {
        setTripSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [ride.status]);

  // Dynamic speed updates for Mobile (GPS handles active speed; resets to 0 if not started)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (ride.status !== 'started') {
      setSpeed(0);
    }
  }, [ride.status]);

  // Web-only ride simulation loop (moves along the route coordinates step-by-step)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (routeCoordinates.length === 0) return;
    
    // We only simulate movement if status is 'accepted' (driving to pickup) or 'started' (driving to destination)
    if (ride.status !== 'accepted' && ride.status !== 'started') {
      setSpeed(0);
      return;
    }

    let currentIndex = 0;
    
    // Set initial speed
    setSpeed(45);

    const intervalId = setInterval(() => {
      if (currentIndex < routeCoordinates.length) {
        const nextCoord = routeCoordinates[currentIndex];
        
        setDriverLocation(prev => {
          // Calculate heading/bearing
          const nextHeading = calculateBearing(prev.latitude, prev.longitude, nextCoord.latitude, nextCoord.longitude);
          setHeading(nextHeading);
          return { latitude: nextCoord.latitude, longitude: nextCoord.longitude };
        });

        // Emit location via socket to keep backend and user screen in sync
        emitLocation(driver.id, nextCoord.latitude, nextCoord.longitude);

        // Fluctuate speed slightly
        setSpeed(() => {
          const change = Math.floor(Math.random() * 9) - 4; // -4 to +4
          return Math.min(Math.max(45 + change, 35), 55);
        });

        currentIndex++;
      } else {
        // Reached end of path
        setSpeed(0);
        clearInterval(intervalId);
      }
    }, 1500); // Step every 1.5 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [routeCoordinates, ride.status]);

  // Animations
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const cardFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(bottomSheetAnim, { toValue: 1, tension: 50, friction: 9, useNativeDriver: true }),
      Animated.timing(cardFadeAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const fetchRoute = async (startLat, startLng, endLat, endLng) => {
    try {
      const accessToken = 'pk.eyJ1IjoieWFrdWJvdmRldiIsImEiOiJjbW1wNnprYWIwanlxMnBzZHg1ajFoeXowIn0' + '.' + 'mBQl5gkRN8abAbQhYrHPxA';
      const dirUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full&access_token=${accessToken}`;
      const response = await fetch(dirUrl);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setRouteInfo({
          distance: route.distance,
          duration: route.duration,
        });
        const coords = route.geometry.coordinates.map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }));
        setRouteCoordinates(coords);
      }
    } catch (err) {
      console.warn('Routing API error, falling back to straight line:', err);
      const dist = calculateHaversineDistance(startLat, startLng, endLat, endLng);
      setRouteInfo({
        distance: dist,
        duration: dist / 11.1,
      });
      setRouteCoordinates([
        { latitude: startLat, longitude: startLng },
        { latitude: endLat, longitude: endLng }
      ]);
    }
  };

  // Re-routing trigger as driver moves
  useEffect(() => {
    if (!driverLocation) return;
    
    const isPickup = ride.status === 'accepted' || ride.status === 'arriving';
    const destLat = isPickup ? ride.pickup.lat : ride.destination.lat;
    const destLng = isPickup ? ride.pickup.lng : ride.destination.lng;

    let shouldFetch = false;
    if (!lastFetchedLocationRef.current || lastFetchedStatusRef.current !== ride.status) {
      shouldFetch = true;
    } else {
      const latDiff = Math.abs(driverLocation.latitude - lastFetchedLocationRef.current.latitude);
      const lngDiff = Math.abs(driverLocation.longitude - lastFetchedLocationRef.current.longitude);
      // Recalculate route if moved more than ~40 meters (0.0004 deg)
      if (latDiff > 0.0004 || lngDiff > 0.0004) {
        shouldFetch = true;
      }
    }

    if (shouldFetch) {
      lastFetchedLocationRef.current = driverLocation;
      lastFetchedStatusRef.current = ride.status;
      fetchRoute(driverLocation.latitude, driverLocation.longitude, destLat, destLng);
    }
  }, [driverLocation, ride.status, ride.pickup, ride.destination]);

  // Real GPS Tracking (Mobile only)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('GPS ruxsati', 'Geoni yoqmaganingacha zakaz ololmaysan');
          return;
        }

        const currentLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }).catch(() => Location.getLastKnownPositionAsync());
 
        if (currentLoc && active) {
          const lat = currentLoc.coords.latitude;
          const lng = currentLoc.coords.longitude;
          setDriverLocation({ latitude: lat, longitude: lng });
          emitLocation(driver.id, lat, lng);
          
          if (currentLoc.coords.heading !== undefined && currentLoc.coords.heading !== null && currentLoc.coords.heading >= 0) {
            setHeading(currentLoc.coords.heading);
          }
          
          if (currentLoc.coords.speed !== undefined && currentLoc.coords.speed !== null && currentLoc.coords.speed >= 0) {
            const gpsSpeedVal = Math.round(currentLoc.coords.speed * 3.6);
            if (ride.status === 'started') {
              setSpeed(gpsSpeedVal);
            } else {
              setSpeed(0);
            }
          }
  
          if (mapRef.current && isTrackingRef.current) {
            mapRef.current.animateToRegion({
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.006,
              longitudeDelta: 0.006,
            }, 1000);
          }
        }
 
        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (newLocation) => {
            if (!active) return;
            const lat = newLocation.coords.latitude;
            const lng = newLocation.coords.longitude;
            
            // Set heading from GPS or calculate via bearing fallback
            if (newLocation.coords.heading !== undefined && newLocation.coords.heading !== null && newLocation.coords.heading >= 0) {
              setHeading(newLocation.coords.heading);
              setDriverLocation({ latitude: lat, longitude: lng });
            } else {
              setDriverLocation(prev => {
                if (prev.latitude !== lat || prev.longitude !== lng) {
                  const dist = calculateHaversineDistance(prev.latitude, prev.longitude, lat, lng);
                  if (dist > 2) {
                    const calculatedBearing = calculateBearing(prev.latitude, prev.longitude, lat, lng);
                    setHeading(calculatedBearing);
                  }
                }
                return { latitude: lat, longitude: lng };
              });
            }
            
            emitLocation(driver.id, lat, lng);
 
            if (newLocation.coords.speed !== undefined && newLocation.coords.speed !== null && newLocation.coords.speed >= 0) {
              const gpsSpeedVal = Math.round(newLocation.coords.speed * 3.6);
              if (ride.status === 'started') {
                setSpeed(gpsSpeedVal);
              } else {
                setSpeed(0);
              }
            }
 
            if (mapRef.current && isTrackingRef.current) {
              mapRef.current.animateToRegion({
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.006,
                longitudeDelta: 0.006,
              }, 1000);
            }
          }
        );
      } catch (err) {
        console.error('Ride progress tracking error:', err);
      }
    };

    startTracking();

    return () => {
      active = false;
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
    };
  }, []);

  const handleRecenter = () => {
    setIsTracking(true);
    if (Platform.OS === 'web') {
      const map = mapInstanceRef.current;
      if (map) {
        map.easeTo({
          center: [driverLocation.longitude, driverLocation.latitude],
          zoom: 15.5,
          duration: 1000
        });
      }
    } else {
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        }, 1000);
      }
    }
  };

  const handleOpenYandexNavigator = async () => {
    const isPickup = ride.status === 'accepted' || ride.status === 'arriving';
    const destLat = isPickup ? ride.pickup.lat : ride.destination.lat;
    const destLng = isPickup ? ride.pickup.lng : ride.destination.lng;
    
    const appUrl = `yandexnavi://build_route_on_map?lat_to=${destLat}&lon_to=${destLng}`;
    const webUrl = `https://yandex.ru/maps/?rtext=~${destLat},${destLng}`;

    try {
      const supported = await Linking.canOpenURL(appUrl);
      if (supported) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (err) {
      Linking.openURL(webUrl).catch(() => {
        Alert.alert('Xatolik', 'Navigatorni ochish imkoni bo\'lmadi');
      });
    }
  };

  const handleNextStatus = async () => {
    let nextStatus = 'arriving';
    if (ride.status === 'accepted') nextStatus = 'arriving';
    else if (ride.status === 'arriving') nextStatus = 'started';
    else if (ride.status === 'started') nextStatus = 'completed';

    setLoading(true);
    setError('');
    try {
      const response = await api.updateRideStatus(ride._id, nextStatus);
      if (response.success) {
        setRide(response.ride);
        if (nextStatus === 'completed') onRideFinished();
      } else {
        setError(response.message || 'Holatni o\'zgartirishda xatolik');
      }
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const getSwipeConfig = () => {
    switch (ride.status) {
      case 'accepted':
        return { label: 'Yetib keldim →', color: '#D97706', textColor: '#FFFFFF' };
      case 'arriving':
        return { label: 'Sayohatni boshlash →', color: '#10B981', textColor: '#FFFFFF' };
      case 'started':
        return { label: 'Sayohatni yakunlash →', color: '#EF4444', textColor: '#FFFFFF' };
      default:
        return { label: 'Sayohat', color: '#3b32db', textColor: '#FFFFFF' };
    }
  };

  const getStatusInfo = () => {
    switch (ride.status) {
      case 'accepted':
        return { text: 'Yo\'lovchiga yetib boring', icon: '🚗', color: '#D97706', bg: '#FEF3C7' };
      case 'arriving':
        return { text: 'Yo\'lovchi sizni kutmoqda', icon: '⏳', color: '#059669', bg: '#ECFDF5' };
      case 'started':
        return { text: 'Sayohat davom etmoqda', icon: '🛣️', color: '#3b32db', bg: '#EEF2FF' };
      default:
        return { text: 'Kuting...', icon: '⏳', color: '#64748B', bg: '#F1F5F9' };
    }
  };

  const swipeConfig = getSwipeConfig();
  const statusInfo = getStatusInfo();

  // ─── Mapbox ───
  const mapInstanceRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const initMap = async () => {
      if (!window.mapboxgl) {
        const link = document.createElement('link');
        link.href = 'https://api.mapbox.com/mapbox-gl.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://api.mapbox.com/mapbox-gl.js';
        await new Promise((resolve) => { script.onload = resolve; document.head.appendChild(script); });
      }
      window.mapboxgl.accessToken = 'pk.eyJ1IjoieWFrdWJvdmRldiIsImEiOiJjbW1wNnprYWIwanlxMnBzZHg1ajFoeXowIn0' + '.' + 'mBQl5gkRN8abAbQhYrHPxA';
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      pickupMarkerRef.current = null;
      destMarkerRef.current = null;
      driverMarkerRef.current = null;

      const map = new window.mapboxgl.Map({
        container: 'mapbox-driver-progress-map',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [driverLocation.longitude, driverLocation.latitude],
        zoom: 15.5,
      });
      mapInstanceRef.current = map;

      map.on('dragstart', () => setIsTracking(false));
      map.on('zoomstart', () => setIsTracking(false));

      map.on('load', () => {
        if (ride.pickup) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:16px;background:linear-gradient(135deg,#00E676,#00C853);border:3px solid rgba(255,255,255,0.9);box-shadow:0 4px 15px rgba(0,230,118,0.4);font-weight:800;font-size:13px;color:#000;">A</div>';
          pickupMarkerRef.current = new window.mapboxgl.Marker(el)
            .setLngLat([ride.pickup.lng, ride.pickup.lat]).addTo(map);
        }
        if (ride.destination) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:16px;background:linear-gradient(135deg,#FF1744,#D50000);border:3px solid rgba(255,255,255,0.9);box-shadow:0 4px 15px rgba(255,23,68,0.4);font-weight:800;font-size:13px;color:#fff;">B</div>';
          destMarkerRef.current = new window.mapboxgl.Marker(el)
            .setLngLat([ride.destination.lng, ride.destination.lat]).addTo(map);
        }

        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
        map.addLayer({
          id: 'route-glow', type: 'line', source: 'route',
          paint: { 
            'line-color': '#3b32db', 
            'line-width': 8, 
            'line-opacity': 0.12, 
            'line-blur': 8 
          },
        });
        map.addLayer({
          id: 'route', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 
            'line-color': '#3b32db', 
            'line-width': 4 
          },
        });
      });
    };
    initMap();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:20px;background:rgba(59,50,219,0.25);box-shadow:0 4px 10px rgba(59,50,219,0.4);"><div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:14px;background:#3b32db;border:2px solid #ffffff;box-shadow:0 2px 5px rgba(0,0,0,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(-45deg);"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div></div>';
      driverMarkerRef.current = new window.mapboxgl.Marker(el)
        .setLngLat([driverLocation.longitude, driverLocation.latitude]).addTo(map);
    } else {
      driverMarkerRef.current.setLngLat([driverLocation.longitude, driverLocation.latitude]);
    }

    if (heading !== undefined && heading !== null) {
      driverMarkerRef.current.setRotation(heading);
    }

    if (isTracking) {
      map.easeTo({ center: [driverLocation.longitude, driverLocation.latitude], zoom: 15.5, duration: 1000 });
    }
  }, [driverLocation.latitude, driverLocation.longitude, heading, isTracking]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const map = mapInstanceRef.current;
    if (!map || routeCoordinates.length === 0) return;
    const routeSource = map.getSource('route');
    if (routeSource) {
      const webCoords = routeCoordinates.map(c => [c.longitude, c.latitude]);
      routeSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: webCoords
        }
      });
      const color = '#3b32db';
      if (map.getLayer('route')) {
        map.setPaintProperty('route', 'line-color', color);
      }
      if (map.getLayer('route-glow')) {
        map.setPaintProperty('route-glow', 'line-color', color);
      }
    }
  }, [routeCoordinates, ride.status]);

  const bottomTranslate = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const formatDistance = (meters) => {
    if (!meters) return '';
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.round(seconds / 60);
    if (mins === 0) return '1 daq';
    return `${mins} daq`;
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View id="mapbox-driver-progress-map" style={{ width: '100%', height: '100%' }} />
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            customMapStyle={lightMapStyle}
            initialRegion={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
              latitudeDelta: 0.006,
              longitudeDelta: 0.006,
            }}
            onPanDrag={() => setIsTracking(false)}
          >
            {/* Driver position */}
            <Marker
              coordinate={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={true}
              rotation={heading}
              title="Siz"
            >
              <View style={styles.driverArrowMarkerOuter}>
                <View style={styles.driverArrowMarkerInner}>
                  <Feather name="navigation" size={18} color="#fff" style={{ transform: [{ rotate: '-45deg' }], marginTop: -2 }} />
                </View>
              </View>
            </Marker>

            {/* Pickup Location A */}
            <Marker
              coordinate={{ latitude: ride.pickup.lat, longitude: ride.pickup.lng }}
              title="Jo'nash (A)"
              description={ride.pickup.address}
            >
              <View style={[styles.pinPoint, styles.pickupPin]}>
                <Text style={styles.pinTextPickup}>A</Text>
              </View>
            </Marker>

            {/* Destination Location B */}
            <Marker
              coordinate={{ latitude: ride.destination.lat, longitude: ride.destination.lng }}
              title="Borish (B)"
              description={ride.destination.address}
            >
              <View style={[styles.pinPoint, styles.destPin]}>
                <Text style={styles.pinTextDest}>B</Text>
              </View>
            </Marker>

            {/* Road route path */}
            {routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#3b32db"
                strokeWidth={5}
              />
            )}
          </MapView>
        )}

        {/* Re-center Button */}
        {!isTracking && (
          <TouchableOpacity
            style={styles.recenterButton}
            activeOpacity={0.85}
            onPress={handleRecenter}
          >
            <Feather name="navigation" size={16} color="#3b32db" style={styles.recenterIcon} />
            <Text style={styles.recenterText}>Markazga qaytish</Text>
          </TouchableOpacity>
        )}

        {/* Floating Navigator HUD overlay */}
        {(() => {
          const nav = getNavigationInstruction();
          return (
            <View style={styles.hudContainer}>
              {/* Premium Navigation Instructions Card */}
              <View style={styles.hudInstructionCard}>
                <View style={styles.hudIconContainer}>
                  <Feather 
                    name={
                      nav.icon === 'arrow-left' ? 'corner-up-left' : 
                      nav.icon === 'arrow-right' ? 'corner-up-right' : 
                      nav.icon === 'arrow-up' ? 'arrow-up' : 
                      nav.icon === 'check-circle' ? 'check-circle' : 'navigation'
                    } 
                    size={24} 
                    color="#3b32db" 
                  />
                </View>
                <View style={styles.hudTextContainer}>
                  <Text style={styles.hudInstructionText}>{nav.instruction}</Text>
                  <Text style={styles.hudStreetText}>{nav.subInstruction}</Text>
                </View>
              </View>

              {/* Speeds & Limits Row */}
            </View>
          );
        })()}
      </View>

      {/* Bottom Sheet */}
      <Animated.View style={[
        styles.bottomSheet,
        { transform: [{ translateY: bottomTranslate }] }
      ]}>
        {/* Drag Handle */}
        <View style={styles.dragHandleRow}>
          <View style={styles.dragHandle} />
        </View>

        {/* Status Header */}
        <View style={[styles.statusHeader, { backgroundColor: '#F8FAFC' }]}>
          <PulsingDot color={statusInfo.color} size={8} />
          <Text style={[styles.statusHeaderText, { color: '#0F172A' }]}>
            {statusInfo.icon} {statusInfo.text}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: `${statusInfo.color}15`, borderColor: `${statusInfo.color}40` }]}>
            <Text style={[styles.statusPillText, { color: statusInfo.color }]}>
              {ride.status === 'accepted' ? 'QABUL QILINDI' : ride.status === 'arriving' ? 'YETIB KELDINGIZ' : 'SAYOHATDA'}
            </Text>
          </View>
        </View>

        {/* Passenger & Route Info */}
        <Animated.View style={[styles.infoSection, { opacity: cardFadeAnim }]}>
          {ride.status === 'started' ? (
            /* Active Trip Started State */
            <View>
              {/* Side-by-side indicator boxes */}
              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Feather name="clock" size={16} color="#3b32db" style={{ marginBottom: 4 }} />
                  <Text style={styles.metricValue}>{getETAClockTime(tripSeconds)}</Text>
                  <Text style={styles.metricLabel}>ETA ({formatCountdown(tripSeconds)})</Text>
                </View>
                <View style={styles.metricCard}>
                  <Feather name="map-pin" size={16} color="#3b32db" style={{ marginBottom: 4 }} />
                  <Text style={styles.metricValue}>{formatDistance(routeInfo.distance) || 'Hosil qilinmoqda...'}</Text>
                  <Text style={styles.metricLabel}>Qolgan masofa</Text>
                </View>
              </View>

              {/* Smaller passenger detail row */}
              <View style={styles.passengerRowCompact}>
                <View style={styles.avatarCircleSmall}>
                  <Text style={styles.avatarTextSmall}>
                    {(ride.userId?.name || '?')[0]}
                  </Text>
                </View>
                <View style={styles.passengerDetailsCompact}>
                  <Text style={styles.passengerNameCompact}>
                    {ride.userId?.name} {ride.userId?.surname}
                  </Text>
                  <Text style={styles.passengerPhoneCompact}>{ride.userId?.phone}</Text>
                </View>
                <View style={styles.priceTagCompact}>
                  <Text style={styles.priceValueCompact}>
                    {((ride.price || 0) + (waitSeconds < 0 ? Math.abs(waitSeconds) * 25 : 0)).toLocaleString()} UZS
                  </Text>
                  {waitSeconds < 0 && (
                    <Text style={{ fontSize: 9, color: '#EF4444', fontWeight: '700', marginTop: 2, textAlign: 'right' }}>
                      +{Math.round(Math.abs(waitSeconds) * 25).toLocaleString()} UZS kutish
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ) : (
            /* Accepted / Arriving (Not started yet) States */
            <View>
              {/* Passenger Card */}
              <View style={styles.passengerCard}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(ride.userId?.name || '?')[0]}
                  </Text>
                </View>
                <View style={styles.passengerDetails}>
                  <Text style={styles.passengerName}>
                    {ride.userId?.name} {ride.userId?.surname}
                  </Text>
                  <Text style={styles.passengerPhone}>{ride.userId?.phone}</Text>
                </View>
                <View style={styles.passengerActions}>
                  <TouchableOpacity
                    style={styles.actionIconButton}
                    onPress={() => {
                      if (ride.userId?.phone) {
                        Linking.openURL(`tel:${ride.userId.phone}`).catch(() => {
                          Alert.alert('Xatolik', 'Qo\'ng\'iroq qilish imkoni bo\'lmadi');
                        });
                      } else {
                        Alert.alert('Xatolik', 'Mijoz telefon raqami mavjud emas');
                      }
                    }}
                  >
                    <Feather name="phone" size={18} color="#3b32db" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionIconButton, { marginLeft: 8 }]}
                    onPress={() => {
                      Alert.alert('Tez kunda', 'Mijoz bilan chat tizimi tez kunda ishga tushadi');
                    }}
                  >
                    <Feather name="message-square" size={18} color="#3b32db" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dynamic Status Badges */}
              <View style={styles.tripBadgeContainer}>
                {ride.status === 'accepted' ? (
                  <View style={[styles.tripBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <Text style={[styles.tripBadgeText, { color: '#3b32db' }]}>
                      ⏱️ Mijozga yetib borish: {formatDistance(routeInfo.distance) || 'Aniqlanmoqda...'} • {formatCountdown(etaSeconds)} qoldi
                    </Text>
                  </View>
                ) : (
                  <View 
                    style={[
                      styles.tripBadge, 
                      waitSeconds >= 0 
                        ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                        : { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }
                    ]}
                  >
                    {waitSeconds >= 0 ? (
                      <Text style={[styles.tripBadgeText, { color: '#D97706' }]}>
                        ⏱️ Bepul kutish vaqti: {formatCountdown(waitSeconds)}
                      </Text>
                    ) : (
                      <Text style={[styles.tripBadgeText, { color: '#DC2626' }]}>
                        ⏱️ Pullik kutish vaqti: +{formatCountdown(Math.abs(waitSeconds))} (+{Math.round(Math.abs(waitSeconds) * 25).toLocaleString()} UZS)
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Additional Services */}
          {ride.options && (ride.options.ac || ride.options.luggage) ? (
            <View style={styles.servicesPillsContainer}>
              {ride.options.ac ? (
                <View style={styles.servicePill}>
                  <Text style={styles.servicePillIcon}>❄️</Text>
                  <Text style={styles.servicePillText}>Konditsioner</Text>
                </View>
              ) : null}
              {ride.options.luggage ? (
                <View style={styles.servicePill}>
                  <Text style={styles.servicePillIcon}>🧳</Text>
                  <Text style={styles.servicePillText}>Orqa bagaj</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Route Row */}
          <View style={styles.routeRow}>
            <View style={styles.routeTimeline}>
              <View style={[styles.routeDot, { backgroundColor: '#10B981' }]} />
              <View style={styles.routeLine} />
              <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
            </View>
            <View style={styles.routeAddresses}>
              <Text style={styles.routeAddr} numberOfLines={1}>{ride.pickup?.address}</Text>
              <Text style={styles.routeAddr} numberOfLines={1}>{ride.destination?.address}</Text>
            </View>
          </View>
        </Animated.View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Swipe Action Row */}
        <View style={styles.swipeContainer}>
          {loading ? (
            <View style={styles.loadingBar}>
              <ActivityIndicator color={swipeConfig.color} size="small" />
              <Text style={[styles.loadingText, { color: swipeConfig.color }]}>Kuting...</Text>
            </View>
          ) : (ride.status === 'accepted' || ride.status === 'started') ? (
            <View style={styles.startedActionsRow}>
              {/* Yandex Navigator Button */}
              <TouchableOpacity
                style={styles.naviButton}
                activeOpacity={0.8}
                onPress={handleOpenYandexNavigator}
              >
                <Feather name="map" size={18} color="#3b32db" style={{ marginBottom: 2 }} />
                <Text style={styles.naviButtonText}>Marshrut</Text>
              </TouchableOpacity>

              {/* Swipe button */}
              <View style={{ flex: 1 }}>
                <SwipeButton
                  label={swipeConfig.label}
                  color={swipeConfig.color}
                  textColor={swipeConfig.textColor}
                  onSwipeComplete={handleNextStatus}
                  disabled={loading}
                />
              </View>
            </View>
          ) : (
            <SwipeButton
              label={swipeConfig.label}
              color={swipeConfig.color}
              textColor={swipeConfig.textColor}
              onSwipeComplete={handleNextStatus}
              disabled={loading}
            />
          )}
        </View>
      </Animated.View>
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
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },

  // Grid fallback (non-web)
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#E2E8F0' },
  gridLineVertical: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#E2E8F0' },
  pin: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15,
    borderWidth: 2.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginLeft: -15, marginTop: -15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6,
  },
  pinText: { color: '#000', fontSize: 13, fontWeight: '800' },
  driverMarkerFallback: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#3b32db',
    alignItems: 'center', justifyContent: 'center', marginLeft: -20, marginTop: -20,
  },

  // Simulator
  simOverlay: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
  },
  simBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 6,
  },
  simBtnActive: {
    backgroundColor: '#10B981', borderColor: '#10B981',
  },
  simBtnIcon: { fontSize: 16, marginRight: 8 },
  simBtnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },

  // Bottom Sheet
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 10,
  },
  dragHandleRow: {
    alignItems: 'center', paddingVertical: 12,
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },

  // Status Header
  statusHeader: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  statusHeaderText: {
    flex: 1, fontSize: 13, fontWeight: '700', marginLeft: 10,
  },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
  },

  // Passenger Card
  infoSection: {
    marginBottom: 14,
  },
  passengerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(59, 50, 219, 0.08)',
    borderWidth: 1, borderColor: 'rgba(59, 50, 219, 0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    color: '#3b32db', fontSize: 18, fontWeight: '800',
  },
  passengerDetails: {
    flex: 1, marginLeft: 12,
  },
  passengerName: {
    color: '#0F172A', fontSize: 16, fontWeight: '800',
  },
  passengerPhone: {
    color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 2,
  },
  priceTag: {
    alignItems: 'flex-end',
  },
  priceValue: {
    color: '#3b32db', fontSize: 20, fontWeight: '800',
  },
  priceCurrency: {
    color: 'rgba(59, 50, 219, 0.6)', fontSize: 10, fontWeight: '600', letterSpacing: 1,
  },

  // Route
  routeRow: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: '#F8FAFC',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  routeTimeline: {
    width: 16, alignItems: 'center', justifyContent: 'space-between',
    marginRight: 12, paddingVertical: 2,
  },
  routeDot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  routeLine: {
    width: 2, flex: 1, backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  routeAddresses: {
    flex: 1, justifyContent: 'space-between',
  },
  routeAddr: {
    color: '#334155', fontSize: 13, fontWeight: '600',
    paddingVertical: 2,
  },

  errorText: {
    color: '#EF4444', fontSize: 12, textAlign: 'center', marginBottom: 10,
  },

  // Swipe Container
  swipeContainer: {
    marginTop: 4,
  },
  loadingBar: {
    height: 64, borderRadius: 32,
    backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#E2E8F0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 10, fontSize: 14, fontWeight: '600',
  },
  hudContainer: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    alignItems: 'stretch',
    zIndex: 999,
  },
  hudInstructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  hudIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 50, 219, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  hudInstructionText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  hudStreetText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  speedIndicatorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  speedometerCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F8FAFC',
    borderWidth: 3,
    borderColor: '#3b32db',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
  },
  speedValueText: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
  },
  speedUnitText: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
    marginTop: -2,
  },
  speedLimitCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  speedLimitText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
  },
  speedLimitUnit: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 7,
    fontWeight: '800',
    marginTop: -2,
  },
  voiceBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
  },
  voiceText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  driverArrowMarkerOuter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(59, 50, 219, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  driverArrowMarkerInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b32db',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1000,
  },
  recenterIcon: {
    marginRight: 6,
    transform: [{ rotate: '-45deg' }],
  },
  recenterText: {
    color: '#3b32db',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pinPoint: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  pickupPin: {
    backgroundColor: '#10B981',
  },
  destPin: {
    backgroundColor: '#EF4444',
  },
  pinTextPickup: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  pinTextDest: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  servicesPillsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: -4,
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  servicePillIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  servicePillText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  passengerRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 10,
    marginBottom: 14,
  },
  avatarCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 50, 219, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 50, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    color: '#3b32db',
    fontSize: 13,
    fontWeight: '800',
  },
  passengerDetailsCompact: {
    flex: 1,
    marginLeft: 10,
  },
  passengerNameCompact: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  passengerPhoneCompact: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  priceTagCompact: {
    alignItems: 'flex-end',
  },
  priceValueCompact: {
    color: '#3b32db',
    fontSize: 14,
    fontWeight: '800',
  },
  passengerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripBadgeContainer: {
    marginBottom: 12,
  },
  tripBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tripBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  startedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  naviButton: {
    width: 64,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  naviButtonText: {
    color: '#3b32db',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
});
