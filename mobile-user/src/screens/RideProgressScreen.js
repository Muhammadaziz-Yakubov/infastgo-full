import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  Share,
  Alert,
} from 'react-native';
import { api } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function RideProgressScreen({ 
  initialRide, 
  user, 
  onRideFinished, 
  onViewHome, 
  onViewHistory, 
  onViewProfile 
}) {
  const insets = useSafeAreaInsets();
  const [ride, setRide] = useState(initialRide);
  const [driverLoc, setDriverLoc] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [rating, setRating] = useState(5);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  // Real-time countdown timers
  // arrivalSecondsLeft: how many seconds until driver arrives (accepted/arriving states)
  // tripSecondsElapsed: how many seconds have passed since trip started
  const [arrivalSecondsLeft, setArrivalSecondsLeft] = useState(null);
  const [tripSecondsElapsed, setTripSecondsElapsed] = useState(0);
  const rideStartedAtRef = useRef(null);
  const arrivalTimerRef = useRef(null);
  const tripTimerRef = useRef(null);
  const searchingSecondsRef = useRef(0);
  const [searchingSeconds, setSearchingSeconds] = useState(0);

  useEffect(() => {
    // Poll the active ride state on mount to ensure we have latest, then connect sockets
    const fetchLatest = async () => {
      try {
        const res = await api.getActiveRide();
        if (res.success && res.ride) {
          setRide(res.ride);
          if (res.ride.driverId && res.ride.driverId.currentLocation) {
            setDriverLoc(res.ride.driverId.currentLocation);
          }
        }
      } catch (err) {
        console.log('Error fetching active ride:', err);
      }
    };
    fetchLatest();

    // Setup Socket connection
    connectSocket(
      user.id,
      (statusUpdate) => {
        if (statusUpdate.status) {
          setRide((prev) => {
            const updated = { ...prev, status: statusUpdate.status };
            if (statusUpdate.driver) {
              updated.driverId = statusUpdate.driver;
            }
            return updated;
          });
        }
      },
      (locUpdate) => {
        setDriverLoc({ lat: locUpdate.lat, lng: locUpdate.lng });
      }
    );

    return () => {
      disconnectSocket();
    };
  }, []);

  // Polling for payment status if payment is pending
  useEffect(() => {
    if (ride && ride.status === 'payment_pending') {
      const interval = setInterval(async () => {
        try {
          const res = await api.getActiveRide();
          if (res.success) {
            if (res.ride) {
              setRide(res.ride);
            } else {
              onRideFinished();
            }
          }
        } catch (e) {
          console.warn('Poll error for payment:', e);
        }
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [ride?.status]);

  // Searching seconds counter
  useEffect(() => {
    if (ride.status !== 'searching') return;
    const interval = setInterval(() => {
      searchingSecondsRef.current += 1;
      setSearchingSeconds(searchingSecondsRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [ride.status]);

  // Arrival countdown when driver accepted/arriving
  useEffect(() => {
    if (ride.status === 'accepted' || ride.status === 'arriving') {
      // Initialize countdown based on estimated distance from driver (default 3 min = 180s)
      if (arrivalSecondsLeft === null) {
        setArrivalSecondsLeft(180);
      }
      if (arrivalTimerRef.current) clearInterval(arrivalTimerRef.current);
      arrivalTimerRef.current = setInterval(() => {
        setArrivalSecondsLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(arrivalTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (arrivalTimerRef.current) clearInterval(arrivalTimerRef.current);
    }
    return () => {
      if (arrivalTimerRef.current) clearInterval(arrivalTimerRef.current);
    };
  }, [ride.status]);

  // Trip elapsed timer when started
  useEffect(() => {
    if (ride.status === 'started') {
      if (!rideStartedAtRef.current) rideStartedAtRef.current = Date.now();
      if (tripTimerRef.current) clearInterval(tripTimerRef.current);
      tripTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - rideStartedAtRef.current) / 1000);
        setTripSecondsElapsed(elapsed);
      }, 1000);
    } else {
      if (tripTimerRef.current) clearInterval(tripTimerRef.current);
    }
    return () => {
      if (tripTimerRef.current) clearInterval(tripTimerRef.current);
    };
  }, [ride.status]);

  useEffect(() => {
    const fetchOSRMRoute = async () => {
      if (!ride.pickup || !ride.destination) return;
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${ride.pickup.lng},${ride.pickup.lat};${ride.destination.lng},${ride.destination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.routes && json.routes.length > 0) {
          const coords = json.routes[0].geometry.coordinates.map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          }));
          setRouteCoordinates(coords);
        } else {
          setRouteCoordinates([
            { latitude: ride.pickup.lat, longitude: ride.pickup.lng },
            { latitude: ride.destination.lat, longitude: ride.destination.lng }
          ]);
        }
      } catch (err) {
        console.warn('OSRM Route fetch error:', err);
        setRouteCoordinates([
          { latitude: ride.pickup.lat, longitude: ride.pickup.lng },
          { latitude: ride.destination.lat, longitude: ride.destination.lng }
        ]);
      }
    };
    fetchOSRMRoute();
  }, [ride.pickup, ride.destination]);

  const handleRateDriver = async () => {
    setRatingLoading(true);
    setError('');
    try {
      await api.rateDriver(ride._id, rating);
      onRideFinished();
    } catch (err) {
      setError(err.message || 'Baholashda xatolik yuz berdi');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    setError('');
    try {
      await api.cancelRide(ride._id);
      onRideFinished();
    } catch (err) {
      console.warn('Cancel ride API error, forcing exit:', err);
      onRideFinished();
    }
  };

  const handleSOS = () => {
    Alert.alert(
      "SOS Fövqulodda yordam",
      "Haqiqatan ham 102 (Militsiya) raqamiga qo'ngiroq qilmoqchimisiz?",
      [
        { text: "Bekor qilish", style: "cancel" },
        { text: "Qo'ngiroq qilish", onPress: () => Linking.openURL('tel:102') }
      ]
    );
  };

  const handleShareTrip = async () => {
    try {
      const shareMessage = `InFast Go orqali yo'ldaman. Haydovchi: ${ride.driverId?.name || ''}. Sayohatimni kuzatib boring.`;
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      console.warn("Ulashishda xatolik:", error);
    }
  };

  const handleCallDriver = () => {
    const driverPhone = ride.driverId?.phone || ride.driverId?.phone_number || '+998901234567';
    Linking.openURL(`tel:${driverPhone}`);
  };

  // Total trip duration in seconds
  const getTotalTripSeconds = () => Math.max(Math.round(ride.distance * 1.8), 2) * 60 + 60;

  // ETA clock time based on remaining seconds
  const getDynamicETATime = () => {
    const remainingSeconds = Math.max(getTotalTripSeconds() - tripSecondsElapsed, 0);
    const etaDate = new Date();
    etaDate.setSeconds(etaDate.getSeconds() + remainingSeconds);
    const hours = etaDate.getHours();
    const minutes = etaDate.getMinutes();
    const formattedMinutes = minutes < 10 ? '0' + minutes : '' + minutes;
    const formattedHours = hours < 10 ? '0' + hours : '' + hours;
    return `${formattedHours}:${formattedMinutes}`;
  };

  // Format seconds to "X daq Y son" display
  const formatCountdown = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0) return `${m} daq ${s} son`;
    return `${s} son`;
  };

  // Format seconds to just minutes display like "3 daq"
  const formatMinutes = (totalSeconds) => {
    const m = Math.ceil(totalSeconds / 60);
    return `${m} daq`;
  };

  // Progress ratio 0-1 for the progress bar
  const getTripProgress = () => {
    const total = getTotalTripSeconds();
    if (total === 0) return 0;
    return Math.min(tripSecondsElapsed / total, 1);
  };

  // Nearest car ETA computed from searchingSeconds (3 min from start)
  const nearestCarSeconds = Math.max(180 - searchingSeconds, 0);
  // Luks = 5 min from start, Tejamkor = 8 min from start
  const luxSeconds = Math.max(300 - searchingSeconds, 0);
  const econSeconds = Math.max(480 - searchingSeconds, 0);

  // Driver arrival countdown: initialized when ride becomes accepted/arriving
  const driverArrivalSeconds = arrivalSecondsLeft !== null ? arrivalSecondsLeft : 180;

  const getStatusBadgeText = () => {
    switch (ride.status) {
      case 'payment_pending':
        return 'To\'lov kutilmoqda';
      case 'searching':
        return 'Qidirilmoqda...';
      case 'accepted':
        return 'Haydovchi qabul qildi';
      case 'arriving':
        return 'Yetib kelmoqda...';
      case 'started':
        return 'Sayohat boshlandi';
      case 'completed':
        return 'Sayohat yakunlandi';
      default:
        return 'Yo\'lda';
    }
  };

  const mapInstanceRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const arrivalMarkerRef = useRef(null);

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
        await new Promise((resolve) => {
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      window.mapboxgl.accessToken = 'pk.eyJ1IjoieWFrdWJvdmRldiIsImEiOiJjbW1wNnprYWIwanlxMnBzZHg1ajFoeXowIn0' + '.' + 'mBQl5gkRN8abAbQhYrHPxA';

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      pickupMarkerRef.current = null;
      destMarkerRef.current = null;
      driverMarkerRef.current = null;
      arrivalMarkerRef.current = null;

      const initialCenter = driverLoc ? [driverLoc.lng, driverLoc.lat] : [ride.pickup.lng, ride.pickup.lat];

      const map = new window.mapboxgl.Map({
        container: 'mapbox-user-progress-map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: initialCenter,
        zoom: 13,
      });

      mapInstanceRef.current = map;

      map.on('load', async () => {
        if (ride.pickup) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:14px;background:#3b32db;border:2.5px solid #fff;box-shadow:0 4px 10px rgba(59,50,219,0.3);font-weight:800;font-size:12px;color:#fff;">A</div>';
          pickupMarkerRef.current = new window.mapboxgl.Marker(el)
            .setLngLat([ride.pickup.lng, ride.pickup.lat])
            .addTo(map);
        }

        if (ride.destination) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:14px;background:#EF4444;border:2.5px solid #fff;box-shadow:0 4px 10px rgba(239,68,68,0.3);font-weight:800;font-size:12px;color:#fff;">B</div>';
          destMarkerRef.current = new window.mapboxgl.Marker(el)
            .setLngLat([ride.destination.lng, ride.destination.lat])
            .addTo(map);
        }

        if (ride.status === 'searching') {
          // Add closest match 3 min label on map
          const arrEl = document.createElement('div');
          arrEl.innerHTML = '<div style="display:flex;align-items:center;background:#3b32db;color:#fff;padding:6px 12px;border-radius:20px;font-weight:bold;font-size:12px;box-shadow:0 4px 10px rgba(59,50,219,0.3);">⏱️ Eng yaqin: 3 daq</div>';
          arrivalMarkerRef.current = new window.mapboxgl.Marker(arrEl)
            .setLngLat([ride.pickup.lng + 0.0015, ride.pickup.lat + 0.0015])
            .addTo(map);
        } else if (ride.status === 'arriving' || ride.status === 'accepted') {
          // Add ETA label
          const arrEl = document.createElement('div');
          arrEl.innerHTML = '<div style="display:flex;align-items:center;background:#3b32db;color:#fff;padding:6px 12px;border-radius:20px;font-weight:bold;font-size:12px;box-shadow:0 4px 10px rgba(59,50,219,0.3);">Kelish: 3 daq</div>';
          arrivalMarkerRef.current = new window.mapboxgl.Marker(arrEl)
            .setLngLat([ride.pickup.lng + 0.0015, ride.pickup.lat + 0.0015])
            .addTo(map);
        }

        // Fetch route
        let routeCoords = [
          [ride.pickup.lng, ride.pickup.lat],
          [ride.destination.lng, ride.destination.lat],
        ];

        try {
          const dirUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${ride.pickup.lng},${ride.pickup.lat};${ride.destination.lng},${ride.destination.lat}?geometries=geojson&overview=full&access_token=${window.mapboxgl.accessToken}`;
          const dirRes = await fetch(dirUrl);
          const dirData = await dirRes.json();
          if (dirData.routes && dirData.routes.length > 0) {
            routeCoords = dirData.routes[0].geometry.coordinates;
          }
        } catch (err) {
          console.warn('Directions API fallback:', err);
        }

        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords } },
        });

        map.addLayer({
          id: 'route-glow', type: 'line', source: 'route',
          paint: { 'line-color': '#3b32db', 'line-width': 8, 'line-opacity': 0.12, 'line-blur': 6 },
        });

        map.addLayer({
          id: 'route', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#3b32db', 'line-width': 3.5 },
        });

        const bounds = new window.mapboxgl.LngLatBounds();
        routeCoords.forEach(c => bounds.extend(c));
        map.fitBounds(bounds, { padding: 60 });
      });
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [ride.status]);

  // Update driver marker position on Mapbox
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const map = mapInstanceRef.current;
    if (!map) return;

    if (driverLoc) {
      if (!driverMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = '<div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;"><div style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(59,50,219,0.25);border:1.5px solid rgba(59,50,219,0.4);"></div><div style="display:flex;align-items:center;justify-content:center;background:#3b32db;color:#fff;width:24px;height:24px;border-radius:12px;border:2px solid white;box-shadow:0 2px 5px rgba(59,50,219,0.3);font-size:11px;">🧭</div></div>';
        
        driverMarkerRef.current = new window.mapboxgl.Marker(el)
          .setLngLat([driverLoc.lng, driverLoc.lat])
          .addTo(map);
      } else {
        driverMarkerRef.current.setLngLat([driverLoc.lng, driverLoc.lat]);
      }
      
      if (ride.status === 'started') {
        map.easeTo({ center: [driverLoc.lng, driverLoc.lat], duration: 1000 });
      }
    }
  }, [driverLoc, ride.status]);

  const mapRef = useRef(null);

  // Render Completed / Rating state (Screen 3 style)
  if (ride.status === 'completed') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.completedContainer, { paddingTop: Math.max(insets?.top || 0, 8) }]}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.completedHeader}>
              <Text style={styles.headerTitleText}>InFast Go</Text>
              <Image
                source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
                style={styles.headerAvatar}
              />
            </View>

            <ScrollView 
              contentContainerStyle={styles.completedScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Success Badge */}
              <View style={styles.successIconContainer}>
                <Feather name="check" size={40} color="#3b32db" />
              </View>

              <Text style={styles.completedTitleText}>Sayohat yakunlandi!</Text>
              <Text style={styles.completedSubtitleText}>InFast Go xizmatidan foydalanganingiz uchun rahmat!</Text>

              {/* Total Fare Card */}
              <View style={styles.completedFareCard}>
                <Text style={styles.fareLabelText}>UMUMIY NARX</Text>
                <View style={styles.fareRowContainer}>
                  <Text style={styles.fareAmountValue}>
                    {ride.price?.toLocaleString()} UZS
                  </Text>
                  <View style={styles.paidBadge}>
                    <Feather 
                      name={ride.paymentMethod === 'click' ? "credit-card" : "dollar-sign"} 
                      size={13} 
                      color="#059669" 
                      style={{ marginRight: 4 }} 
                    />
                    <Text style={styles.paidBadgeText}>
                      {ride.paymentMethod === 'click' ? "Click orqali to'landi" : "Naqd pulda to'landi"}
                    </Text>
                  </View>
                </View>

                <View style={styles.fareDetailsGrid}>
                  <View style={styles.fareDetailCol}>
                    <Text style={styles.fareDetailLabel}>Masofa</Text>
                    <Text style={styles.fareDetailValue}>{ride.distance} km</Text>
                  </View>
                  <View style={styles.fareDetailCol}>
                    <Text style={styles.fareDetailLabel}>Sayohat vaqti</Text>
                    <Text style={styles.fareDetailValue}>{Math.max(Math.round(ride.distance * 1.8), 2) + 1} daq</Text>
                  </View>
                </View>
              </View>

              {/* Driver info block */}
              {ride.driverId && (
                <View style={styles.completedDriverCard}>
                  <Image
                    source={{ uri: 'https://randomuser.me/api/portraits/men/85.jpg' }}
                    style={styles.driverAvatarSmall}
                  />
                  <View style={styles.driverMainInfo}>
                    <Text style={styles.driverNameText}>
                      {ride.driverId.name} {ride.driverId.surname}
                    </Text>
                    <Text style={styles.driverCarText}>
                      {ride.driverId.carInfo?.color} {ride.driverId.carInfo?.make} {ride.driverId.carInfo?.model}
                    </Text>
                  </View>
                </View>
              )}

              {/* Rating form */}
              <View style={styles.completedFormCard}>
                <Text style={styles.ratingTitleText}>Sayohat sizga yoqdimi?</Text>
                
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => setRating(star)}
                      activeOpacity={0.7}
                    >
                      <Feather 
                        name="star" 
                        size={32} 
                        color={rating >= star ? '#F59E0B' : '#E2E8F0'} 
                        style={{ marginHorizontal: 6 }} 
                        fill={rating >= star ? '#F59E0B' : 'transparent'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.commentLabelText}>Fikr-mulohazalar (ixtiyoriy)</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Sayohat taassurotlari haqida yozing..."
                  placeholderTextColor="#94A3B8"
                  value={comment}
                  onChangeText={setComment}
                  multiline={true}
                  numberOfLines={3}
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* Done Button */}
                <TouchableOpacity
                  style={[styles.doneButton, ratingLoading && styles.doneButtonDisabled]}
                  onPress={handleRateDriver}
                  disabled={ratingLoading}
                  activeOpacity={0.8}
                >
                  {ratingLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.doneButtonText}>Tayyor</Text>
                      <Feather name="arrow-right" size={16} color="#fff" style={{ marginLeft: 6 }} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Bottom Tab Navigation Bar with SAFE AREA padding */}
            <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets?.bottom || 0, 12) }]}>
              <TouchableOpacity style={styles.tabItem} onPress={onViewHome} activeOpacity={0.8}>
                <View style={styles.inactiveTabIcon}>
                  <Feather name="home" size={20} color="#64748B" />
                </View>
                <Text style={styles.inactiveTabLabel}>Bosh sahifa</Text>
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
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  // Render Map and Active status tracking
  return (
    <View style={styles.container}>
      {/* Map simulator */}
      <View style={styles.mapSimulator}>
        {Platform.OS === 'web' ? (
          <View id="mapbox-user-progress-map" style={{ width: '100%', height: '100%' }} />
        ) : (
          <View style={{ width: '100%', height: '100%', position: 'relative' }}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: driverLoc ? driverLoc.lat : (ride.pickup ? ride.pickup.lat : 41.311081),
                longitude: driverLoc ? driverLoc.lng : (ride.pickup ? ride.pickup.lng : 69.240562),
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {ride.pickup && (
                <Marker
                  coordinate={{ latitude: ride.pickup.lat, longitude: ride.pickup.lng }}
                  title="Jo'nash"
                  description={ride.pickup.address}
                >
                  <View style={[styles.pinPoint, styles.pickupPin, { position: 'relative', marginTop: 0, marginLeft: 0 }]}>
                    <Text style={styles.pinText}>A</Text>
                  </View>
                </Marker>
              )}
              {ride.destination && (
                <Marker
                  coordinate={{ latitude: ride.destination.lat, longitude: ride.destination.lng }}
                  title="Borish"
                  description={ride.destination.address}
                >
                  <View style={[styles.pinPoint, styles.destPin, { position: 'relative', marginTop: 0, marginLeft: 0 }]}>
                    <Text style={styles.pinText}>B</Text>
                  </View>
                </Marker>
              )}
              {routeCoordinates.length > 0 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#3b32db"
                  strokeWidth={4.5}
                />
              )}
              {driverLoc && (
                <Marker
                  coordinate={{ latitude: driverLoc.lat, longitude: driverLoc.lng }}
                  title="Haydovchi"
                  description="Haydovchining joriy joylashuvi"
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.driverCarMarkerContainer}>
                    <View style={styles.driverCarMarkerPulse} />
                    <View style={styles.driverCarMarkerIconBg}>
                      <Feather name="navigation" size={14} color="#FFFFFF" style={{ transform: [{ rotate: '45deg' }] }} />
                    </View>
                  </View>
                </Marker>
              )}
              {/* Native Closest match indicator */}
              {ride.status === 'searching' && (
                <Marker
                  coordinate={{ latitude: ride.pickup.lat + 0.0015, longitude: ride.pickup.lng + 0.0015 }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.nativeArrivalMarker}>
                    <Text style={styles.nativeArrivalMarkerText}>
                      ⏱️ Eng yaqin: {nearestCarSeconds > 0 ? formatCountdown(nearestCarSeconds) : 'Kelmoqda...'}
                    </Text>
                  </View>
                </Marker>
              )}
              {/* Native ETA indicator */}
              {(ride.status === 'accepted' || ride.status === 'arriving') && (
                <Marker
                  coordinate={{ latitude: ride.pickup.lat + 0.0015, longitude: ride.pickup.lng + 0.0015 }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.nativeArrivalMarker}>
                    <Text style={styles.nativeArrivalMarkerText}>
                      Kelish: {driverArrivalSeconds > 0 ? formatCountdown(driverArrivalSeconds) : 'Keldi!'}
                    </Text>
                  </View>
                </Marker>
              )}
            </MapView>
          </View>
        )}

        {/* Top Header Bar */}
        <View style={[styles.mapHeader, { top: Math.max(insets?.top || 0, 16) }]}>
          <View style={styles.userInfo}>
            <Text style={styles.headerTitleText}>InFast Go</Text>
            <View style={styles.statusCapsuleBadge}>
              <View style={[
                styles.statusDot,
                ride.status === 'payment_pending' ? { backgroundColor: '#EF4444' } :
                ride.status === 'searching' ? { backgroundColor: '#F59E0B' } : { backgroundColor: '#10B981' }
              ]} />
              <Text style={styles.statusCapsuleText}>
                {getStatusBadgeText()}
              </Text>
            </View>
          </View>
          <Image
            source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
            style={styles.headerAvatar}
          />
        </View>

        {/* Searching overlays (Screen 2 style) */}
        {ride.status === 'searching' && (
          <View style={styles.searchingOverlayCard}>
            <Text style={styles.searchingTitleText}>Haydovchi qidirilmoqda...</Text>
            <Text style={styles.searchingSubtitleText}>Hududingizda talab yuqori</Text>
            
            <View style={styles.closestMatchPill}>
              <Feather name="zap" size={14} color="#3b32db" style={{ marginRight: 6 }} />
              <Text style={styles.closestMatchText}>
                ENG YAQIN MASHINA • {nearestCarSeconds > 0 ? formatCountdown(nearestCarSeconds) : 'Kelmoqda...'}
              </Text>
            </View>

          </View>
        )}

        {/* ETA overlay for arriving/en-route (Screen 1 style) */}
        {(ride.status === 'accepted' || ride.status === 'arriving') && (
          <View style={styles.etaIndicatorMapBadge}>
            <Text style={styles.etaIndicatorText}>
              Kelish: {driverArrivalSeconds > 0 ? formatCountdown(driverArrivalSeconds) : 'Keldi!'}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Sheet Details */}
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets?.bottom || 0, 12) }]}>
        <View style={styles.dragHandleRow}>
          <View style={styles.dragHandle} />
        </View>

        {ride.status === 'payment_pending' ? (
          /* PAYMENT PENDING STATE SHEET */
          <View style={styles.activeTripSheetContent}>
            <View style={styles.paymentPendingHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentPendingTitle}>To'lov kutilmoqda</Text>
                <Text style={styles.paymentPendingSubtitle}>Click orqali to'lovni yakunlang</Text>
              </View>
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>
                  {ride.price?.toLocaleString()} UZS
                </Text>
              </View>
            </View>

            <View style={styles.paymentMethodLabelRow}>
              <View style={[styles.paymentOptionIconBg, { backgroundColor: 'rgba(59, 50, 219, 0.08)', width: 36, height: 36, borderRadius: 10, marginRight: 0 }]}>
                <Feather name="credit-card" size={16} color="#3b32db" />
              </View>
              <Text style={styles.paymentMethodLabelText}>Click to'lov tizimi</Text>
            </View>

            <View style={styles.paymentActionsRow}>
              <TouchableOpacity
                style={styles.payNowButton}
                onPress={() => {
                  if (ride.paymentUrl) {
                    Linking.openURL(ride.paymentUrl);
                  } else {
                    Alert.alert('Xatolik', 'To\'lov havolasi topilmadi.');
                  }
                }}
                activeOpacity={0.8}
              >
                <Feather name="external-link" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.payNowButtonText}>Click orqali to'lash</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelPaymentButton}
                onPress={handleCancelRequest}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelPaymentButtonText}>Sayohatni bekor qilish</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : ride.status === 'searching' ? (
          /* SEARCHING STATE SHEET (Screen 2 style) */
          <View style={styles.searchingSheetContent}>
            <View style={styles.destinationDisplayRow}>
              <View style={styles.destIconBg}>
                <Feather name="map" size={16} color="#10B981" />
              </View>
              <View style={styles.destTextContainer}>
                <Text style={styles.destLabelText}>Borish manzili</Text>
                <Text style={styles.destAddressText} numberOfLines={1}>
                  {ride.destination?.address}
                </Text>
              </View>
              <View style={styles.fareContainer}>
                <Text style={styles.fareLabelSmall}>Narxi</Text>
                <Text style={styles.fareAmountText}>
                  {ride.price?.toLocaleString()} UZS
                </Text>
              </View>
            </View>

            <View style={styles.searchingActionsRow}>
              <TouchableOpacity 
                style={[styles.cancelRequestButton, { flex: 1 }]} 
                onPress={handleCancelRequest}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelRequestText}>Bekor qilish</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : ride.status === 'started' ? (
          /* ON TRIP STATE SHEET (Screen 1 style) */
          <View style={styles.activeTripSheetContent}>
            <View style={styles.activeTripHeader}>
              <View>
                <Text style={styles.arrivingTitle}>
                  Qoldi: {formatCountdown(Math.max(getTotalTripSeconds() - tripSecondsElapsed, 0))}
                </Text>
                <Text style={styles.arrivingSubtitle}>
                  {ride.distance} km • {ride.tariff ? ride.tariff.charAt(0).toUpperCase() + ride.tariff.slice(1) : 'Komfort'}
                </Text>
              </View>
              <View style={styles.etaScheduleContainer}>
                <Text style={styles.etaTimeText}>{getDynamicETATime()}</Text>
                <Text style={styles.onScheduleText}>Yetib borish</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.round(getTripProgress() * 100)}%` }]} />
            </View>

            <View style={styles.pointsDisplayRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.bluePointDot} />
                <Text style={styles.pointLabel}>Jo'nash joyi</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.pointLabel}>Borish manzili</Text>
                <Feather name="map-pin" size={14} color="#3b32db" style={{ marginLeft: 6 }} />
              </View>
            </View>

            {/* Driver details Card */}
            {ride.driverId && (
              <View style={styles.driverDetailsCard}>
                <Image
                  source={{ uri: 'https://randomuser.me/api/portraits/men/85.jpg' }}
                  style={styles.driverAvatarMedium}
                />
                <View style={styles.driverDetailsInfo}>
                  <Text style={styles.driverNameLarge}>
                    {ride.driverId.name} {ride.driverId.surname}
                  </Text>
                  <Text style={styles.driverCarLarge}>
                    {ride.driverId.carInfo?.color} {ride.driverId.carInfo?.make} {ride.driverId.carInfo?.model}
                  </Text>
                  <Text style={styles.driverPlateLarge}>
                    Raqam: {ride.driverId.carInfo?.plateNumber}
                  </Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Feather name="star" size={12} color="#F59E0B" fill="#F59E0B" style={{ marginRight: 4 }} />
                  <Text style={styles.ratingBadgeText}>4.98</Text>
                </View>
              </View>
            )}

            {/* Destination detail card */}
            <View style={styles.destAddressCard}>
              <View style={styles.destIconBgBlue}>
                <Feather name="map-pin" size={14} color="#3b32db" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.destLabelSmall}>BORISH MANZILI</Text>
                <Text style={styles.destAddressSmall} numberOfLines={1}>
                  {ride.destination?.address}
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.tripActionsRow}>
              <TouchableOpacity 
                style={styles.shareTripBtn} 
                onPress={handleShareTrip}
                activeOpacity={0.8}
              >
                <Feather name="share" size={16} color="#3b32db" style={{ marginRight: 6 }} />
                <Text style={styles.shareTripText}>Sayohatni ulashish</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sosBtn} 
                onPress={handleSOS}
                activeOpacity={0.8}
              >
                <Feather name="alert-triangle" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.sosText}>SOS</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom action controls */}
            <View style={styles.circularControlsRow}>
              <TouchableOpacity 
                style={styles.circularBtnItem} 
                onPress={handleCallDriver}
                activeOpacity={0.7}
              >
                <View style={styles.circularIconBg}>
                  <Feather name="phone" size={18} color="#3b32db" />
                </View>
                <Text style={styles.circularLabel}>Qo'ngiroq</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.circularBtnItem} 
                onPress={handleCancelRequest}
                activeOpacity={0.7}
              >
                <View style={[styles.circularIconBg, { backgroundColor: '#FEE2E2' }]}>
                  <Feather name="x-circle" size={18} color="#EF4444" />
                </View>
                <Text style={[styles.circularLabel, { color: '#EF4444' }]}>Bekor qilish</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ACCEPTED / ARRIVING STATE SHEET (Screen 4 style) */
          <View style={styles.activeTripSheetContent}>
            {/* Driver details Card */}
            {ride.driverId && (
              <View style={styles.driverOverviewRow}>
                <Image
                  source={{ uri: 'https://randomuser.me/api/portraits/men/85.jpg' }}
                  style={styles.driverAvatarMedium}
                />
                
                <View style={styles.driverDetailsInfo}>
                  <Text style={styles.driverNameLarge}>
                    {ride.driverId.name} {ride.driverId.surname}
                  </Text>
                  <Text style={styles.driverCarLarge}>
                    {ride.driverId.carInfo?.color} {ride.driverId.carInfo?.make} {ride.driverId.carInfo?.model}
                  </Text>
                  <View style={styles.plateAndRatingRow}>
                    <View style={styles.plateCap}>
                      <Text style={styles.plateCapText}>
                        {ride.driverId.carInfo?.plateNumber}
                      </Text>
                    </View>
                    <View style={styles.ratingBadge}>
                      <Feather name="star" size={10} color="#F59E0B" fill="#F59E0B" style={{ marginRight: 4 }} />
                      <Text style={styles.ratingBadgeText}>4.98</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.etaDisplayBadge}>
                  <Text style={styles.etaBadgeLabel}>KELISH</Text>
                  <Text style={styles.etaBadgeValue}>
                    {driverArrivalSeconds > 0 ? formatCountdown(driverArrivalSeconds) : 'Keldi!'}
                  </Text>
                </View>
              </View>
            )}

            {/* Communication Actions */}
            <View style={styles.commActionsRow}>
              <TouchableOpacity 
                style={[styles.commCallBtn, { flex: 1, backgroundColor: '#3b32db', justifyContent: 'center' }]} 
                onPress={handleCallDriver}
                activeOpacity={0.8}
              >
                <Feather name="phone" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={[styles.commCallText, { color: '#FFFFFF' }]}>Qo'ngiroq qilish</Text>
              </TouchableOpacity>
            </View>

            {/* Destination address card */}
            <View style={styles.destAddressCard}>
              <View style={styles.destIconBgBlue}>
                <Feather name="map-pin" size={14} color="#3b32db" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.destLabelSmall}>BORISH MANZILI</Text>
                <Text style={styles.destAddressSmall} numberOfLines={1}>
                  {ride.destination?.address}
                </Text>
              </View>
            </View>

            {/* Circular Controls Row */}
            <View style={styles.circularControlsRow}>
              <TouchableOpacity 
                style={styles.circularBtnItem} 
                onPress={handleCallDriver}
                activeOpacity={0.7}
              >
                <View style={styles.circularIconBg}>
                  <Feather name="phone" size={18} color="#3b32db" />
                </View>
                <Text style={styles.circularLabel}>Qo'ngiroq</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.circularBtnItem} 
                onPress={handleCancelRequest}
                activeOpacity={0.7}
              >
                <View style={[styles.circularIconBg, { backgroundColor: '#FEE2E2' }]}>
                  <Feather name="x-circle" size={18} color="#EF4444" />
                </View>
                <Text style={[styles.circularLabel, { color: '#EF4444' }]}>Bekor qilish</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mapSimulator: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  pinPoint: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginLeft: -14, marginTop: -14,
  },
  pickupPin: { backgroundColor: '#3b32db', borderWidth: 2, borderColor: '#fff' },
  destPin: { backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#fff' },
  pinText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  driverCarMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  driverCarMarkerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 50, 219, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 50, 219, 0.4)',
  },
  driverCarMarkerIconBg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3b32db',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  nativeArrivalMarker: {
    backgroundColor: '#3b32db',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  nativeArrivalMarkerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // Header Bar
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
  headerTitleText: {
    color: '#1E1B4B', 
    fontSize: 19, 
    fontWeight: '800',
  },
  statusCapsuleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#EEF0F8',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusCapsuleText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  headerAvatar: {
    width: 36, 
    height: 36, 
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },

  // Searching floating card (Screen 2 style)
  searchingOverlayCard: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF0F8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 100,
  },
  searchingTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchingSubtitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
  closestMatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF0FF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,50,219,0.1)',
  },
  closestMatchText: {
    color: '#3b32db',
    fontSize: 12,
    fontWeight: '800',
  },
  otherMatchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  otherMatchCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  otherMatchLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  otherMatchTime: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },

  // ETA map badge
  etaIndicatorMapBadge: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#3b32db',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  etaIndicatorText: {
    color: '#3b32db',
    fontSize: 12,
    fontWeight: '800',
  },

  // Bottom Sheet
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
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

  // Searching sheet content (Screen 2)
  searchingSheetContent: {
    paddingVertical: 8,
  },
  destinationDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  destIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  destTextContainer: {
    flex: 1,
  },
  destLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  destAddressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  fareContainer: {
    alignItems: 'flex-end',
  },
  fareLabelSmall: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  fareAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3b32db',
    marginTop: 2,
  },
  searchingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keepSearchingButton: {
    flex: 1.5,
    backgroundColor: '#3b32db',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  keepSearchingButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelRequestButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  cancelRequestText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },

  // Active Trip Sheet Content
  activeTripSheetContent: {
    paddingVertical: 4,
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  arrivingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  arrivingSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  etaScheduleContainer: {
    alignItems: 'flex-end',
  },
  etaTimeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3b32db',
  },
  onScheduleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b32db',
    borderRadius: 3,
    minWidth: 4,
  },
  pointsDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  bluePointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b32db',
    marginRight: 6,
  },
  pointLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },

  // Driver details card
  driverDetailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  driverAvatarMedium: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  driverDetailsInfo: {
    flex: 1,
  },
  driverNameLarge: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  driverCarLarge: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  driverPlateLarge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3b32db',
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },

  // Driver Overview accepted/arriving row
  driverOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    marginBottom: 14,
  },
  plateAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  plateCap: {
    backgroundColor: '#EEF0FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  plateCapText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3b32db',
  },
  etaDisplayBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0FF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,50,219,0.1)',
  },
  etaBadgeLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
  },
  etaBadgeValue: {
    fontSize: 18,
    fontWeight: '850',
    color: '#3b32db',
  },

  // Comm Actions row (Screen 4 style)
  commActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  commCallBtn: {
    flex: 1,
    backgroundColor: '#EEF1FF',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  commCallText: {
    color: '#3b32db',
    fontSize: 14,
    fontWeight: '750',
  },
  commChatBtn: {
    flex: 1.5,
    backgroundColor: '#3b32db',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  commChatText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '750',
  },

  // Destination address card style
  destAddressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  destIconBgBlue: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(59,50,219,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  destLabelSmall: {
    fontSize: 8,
    fontWeight: '750',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  destAddressSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },

  // Trip Actions row
  tripActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  shareTripBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3b32db',
    marginRight: 10,
  },
  shareTripText: {
    color: '#3b32db',
    fontSize: 14,
    fontWeight: '700',
  },
  sosBtn: {
    flex: 1.2,
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Circular actions row (Screen 1 footer style)
  circularControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 14,
  },
  circularBtnItem: {
    alignItems: 'center',
  },
  circularIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  circularLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },

  // COMPLETED RIDE SCREEN STYLING (Screen 3 style)
  completedContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#EEF0F8',
    backgroundColor: '#FFFFFF',
  },
  completedScroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 140,
    alignItems: 'center',
  },
  successIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(59,50,219,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  completedTitleText: {
    fontSize: 22,
    fontWeight: '850',
    color: '#0F172A',
  },
  completedSubtitleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
    marginBottom: 24,
  },
  completedFareCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF0F8',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  fareLabelText: {
    fontSize: 10,
    fontWeight: '750',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  fareRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 16,
    marginBottom: 16,
  },
  fareAmountValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  paidBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  fareDetailsGrid: {
    flexDirection: 'row',
  },
  fareDetailCol: {
    flex: 1,
  },
  fareDetailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  fareDetailValue: {
    fontSize: 14,
    fontWeight: '750',
    color: '#3b32db',
    marginTop: 4,
  },
  completedDriverCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF0F8',
    marginBottom: 16,
  },
  driverAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  driverMainInfo: {
    flex: 1,
  },
  driverNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  driverCarText: {
    fontSize: 12,
    fontWeight: '550',
    color: '#64748B',
    marginTop: 2,
  },
  completedFormCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF0F8',
  },
  ratingTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 14,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  commentLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  commentInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    textAlignVertical: 'top',
    height: 70,
    marginBottom: 14,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b32db',
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  doneButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '750',
  },
  receiptTextButton: {
    alignItems: 'center',
    marginTop: 14,
  },
  receiptText: {
    color: '#3b32db',
    fontSize: 13,
    fontWeight: '800',
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
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  inactiveTabIcon: {
    width: 58,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  inactiveTabLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  paymentPendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentPendingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  paymentPendingSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  priceBadge: {
    backgroundColor: '#EEF0FF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,50,219,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceBadgeText: {
    color: '#3b32db',
    fontSize: 15,
    fontWeight: '800',
  },
  paymentMethodLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  paymentMethodLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginLeft: 12,
  },
  paymentActionsRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  payNowButton: {
    backgroundColor: '#10B981',
    borderRadius: 18,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 12,
  },
  payNowButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelPaymentButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  cancelPaymentButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
