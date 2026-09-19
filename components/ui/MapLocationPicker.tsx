import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { ChevronLeft } from '@/components/icons';

export type LocationResult = {
  latitude: number;
  longitude: number;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  displayName: string;
};

interface MapLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (result: LocationResult) => void;
  initialLat?: number;
  initialLng?: number;
}

// Default center: New Delhi (28.6139, 77.2090)
const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.2090;

export default function MapLocationPicker({
  visible,
  onClose,
  onSelectLocation,
  initialLat = DEFAULT_LAT,
  initialLng = DEFAULT_LNG,
}: MapLocationPickerProps) {
  const [lat, setLat] = useState<number>(initialLat);
  const [lng, setLng] = useState<number>(initialLng);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const [addressData, setAddressData] = useState<{
    displayName: string;
    road: string;
    city: string;
    state: string;
    postcode: string;
  }>({
    displayName: 'Locating address…',
    road: '',
    city: '',
    state: '',
    postcode: '',
  });

  const webViewRef = useRef<WebView>(null);

  // Reverse Geocoding via Nominatim
  const reverseGeocode = async (latitude: number, longitude: number) => {
    setAddressLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'OurthApp/1.0',
          },
        }
      );
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.suburb || addr.neighbourhood || addr.residential || '';
        const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
        const state = addr.state || '';
        const postcode = addr.postcode || '';
        const displayName = data.display_name || [road, city, state, postcode].filter(Boolean).join(', ');

        setAddressData({
          displayName,
          road,
          city,
          state,
          postcode,
        });
      } else {
        setAddressData({
          displayName: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
          road: '',
          city: '',
          state: '',
          postcode: '',
        });
      }
    } catch {
      setAddressData({
        displayName: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
        road: '',
        city: '',
        state: '',
        postcode: '',
      });
    } finally {
      setAddressLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setLat(initialLat);
      setLng(initialLng);
      reverseGeocode(initialLat, initialLng);
    }
  }, [visible, initialLat, initialLng]);

  // Handle GPS location request
  const handleUseCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to pinpoint your location on map.');
        setLoadingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const newLat = loc.coords.latitude;
      const newLng = loc.coords.longitude;
      setLat(newLat);
      setLng(newLng);
      updateMapCenter(newLat, newLng);
      reverseGeocode(newLat, newLng);
    } catch {
      Alert.alert('Location Error', 'Could not retrieve current location.');
    } finally {
      setLoadingLocation(false);
    }
  };

  // Search location
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=in&limit=1`,
        {
          headers: { 'User-Agent': 'OurthApp/1.0' },
        }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const newLat = parseFloat(item.lat);
        const newLng = parseFloat(item.lon);
        setLat(newLat);
        setLng(newLng);
        updateMapCenter(newLat, newLng);
        reverseGeocode(newLat, newLng);
      } else {
        Alert.alert('Not Found', 'No location found for this search.');
      }
    } catch {
      Alert.alert('Search Error', 'Failed to search location.');
    } finally {
      setSearching(false);
    }
  };

  const updateMapCenter = (latitude: number, longitude: number) => {
    if (webViewRef.current) {
      const script = `if (window.map) { window.map.setView([${latitude}, ${longitude}], 16); } true;`;
      webViewRef.current.injectJavaScript(script);
    }
  };

  const handleConfirm = () => {
    onSelectLocation({
      latitude: lat,
      longitude: lng,
      addressLine: addressData.road || addressData.displayName.split(',')[0] || '',
      city: addressData.city,
      state: addressData.state,
      postalCode: addressData.postcode,
      displayName: addressData.displayName,
    });
    onClose();
  };

  const leafletHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #f0f0f0; }
          .center-pin {
            position: absolute;
            top: 50%;
            left: 50%;
            margin-top: -36px;
            margin-left: -18px;
            z-index: 1000;
            pointer-events: none;
          }
          .pin-shadow {
            position: absolute;
            top: 50%;
            left: 50%;
            margin-top: -4px;
            margin-left: -8px;
            width: 16px;
            height: 8px;
            background: rgba(0,0,0,0.25);
            border-radius: 50%;
            z-index: 999;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="pin-shadow"></div>
        <div class="center-pin">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4A9B5F" stroke="#FFFFFF" stroke-width="1.5"/>
            <circle cx="12" cy="9" r="2.5" fill="#FFFFFF"/>
          </svg>
        </div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          map.on('moveend', function() {
            var center = map.getCenter();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'CENTER_CHANGED',
              lat: center.lat,
              lng: center.lng
            }));
          });
          window.map = map;
        </script>
      </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pin Location on Map</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search area, landmark, or city…"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
            {searching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.searchBtnText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Map View */}
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={leafletHTML}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Map"
            />
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: leafletHTML }}
              style={{ flex: 1 }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'CENTER_CHANGED') {
                    setLat(data.lat);
                    setLng(data.lng);
                    reverseGeocode(data.lat, data.lng);
                  }
                } catch {}
              }}
            />
          )}

          {/* Current Location GPS Button */}
          <TouchableOpacity
            style={styles.gpsBtn}
            onPress={handleUseCurrentLocation}
            disabled={loadingLocation}
          >
            {loadingLocation ? (
              <ActivityIndicator color="#4A9B5F" size="small" />
            ) : (
              <Text style={styles.gpsBtnText}>📍 Current GPS</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Location Summary Card */}
        <View style={styles.bottomCard}>
          <Text style={styles.cardLabel}>SELECTED PIN LOCATION</Text>

          {addressLoading ? (
            <View style={styles.addressLoadingRow}>
              <ActivityIndicator size="small" color="#4A9B5F" />
              <Text style={styles.addressLoadingText}>Updating address from pin…</Text>
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              <Text style={styles.addressTitle} numberOfLines={2}>
                {addressData.displayName}
              </Text>
              <Text style={styles.coordsText}>
                Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>Confirm Pin Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  searchBtn: {
    backgroundColor: '#4A9B5F',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  gpsBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  gpsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  bottomCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A9B5F',
    letterSpacing: 0.5,
  },
  addressLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  addressLoadingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
  },
  coordsText: {
    fontSize: 12,
    color: '#6b7280',
  },
  confirmBtn: {
    backgroundColor: '#4A9B5F',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
