import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { ChevronLeft, Package, MapPin } from '@/components/icons';
import api, { fixAssetUrl, API_BASE_URL } from '@/lib/api';
import * as SecureStore from 'expo-secure-store';
import type { Order } from '@/lib/types';

const { width: W, height: H } = Dimensions.get('window');
const MAP_HEIGHT = Math.floor(H * 0.42);
const POLL_MS = 5000;

// â”€â”€â”€ Status config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATUS_STEPS  = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = ['Received', 'Preparing', 'Ready Box', 'Out for Delivery', 'Delivered'];

const STATUS_DISPLAY: Record<string, { title: string; subtitle: string }> = {
  pending:          { title: 'Order Received',   subtitle: 'Your order is being confirmed' },
  confirmed:        { title: 'Order Confirmed',  subtitle: 'Being prepared by vendor' },
  processing:       { title: 'Ready to Ship',    subtitle: 'Your order is packed and ready' },
  out_for_delivery: { title: 'Out for Delivery', subtitle: 'Your rider is on the way!' },
  delivered:        { title: 'Order Delivered',  subtitle: 'Thank you for shopping with us!' },
  cancelled:        { title: 'Order Cancelled',  subtitle: 'This order has been cancelled' },
};

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface LatLng { lat: number; lng: number }

interface TrackingData {
  order_id: number;
  order_number: string;
  order_status: string;
  pickup: (LatLng & { name: string }) | null;
  rider: (LatLng & { bearing: number; status_message: string | null; updated_at: string }) | null;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ordinalDate(dateStr: string): string {
  const d      = new Date(dateStr);
  const day    = d.getDate();
  const mod100 = day % 100;
  const mod10  = day % 10;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? 'th'
    : mod10 === 1 ? 'st'
    : mod10 === 2 ? 'nd'
    : mod10 === 3 ? 'rd'
    : 'th';
  const month = d.toLocaleString('en', { month: 'short' });
  return `${day}${suffix} ${month}, ${d.getFullYear()}`;
}

/** Build a LatLng ~500m north-east of pickup as the delivery pin placeholder */
function deliveryFromPickup(pickup: LatLng): LatLng {
  return { lat: pickup.lat + 0.005, lng: pickup.lng + 0.007 };
}

function regionFromPoints(points: LatLng[]): Region {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude:       (minLat + maxLat) / 2,
    longitude:      (minLng + maxLng) / 2,
    latitudeDelta:  Math.max(maxLat - minLat, 0.01) * 1.6,
    longitudeDelta: Math.max(maxLng - minLng, 0.01) * 1.6,
  };
}

// â”€â”€â”€ Status Progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatusProgress({ status }: { status: string }) {
  const currentIndex = STATUS_STEPS.indexOf(status);
  const isCancelled  = status === 'cancelled';
  const pct = isCancelled ? 0 : (currentIndex / (STATUS_STEPS.length - 1)) * 100;

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.stepsRow}>
        {STATUS_LABELS.map((label, i) => {
          const done   = !isCancelled && i <= currentIndex;
          const active = !isCancelled && i === currentIndex;
          return (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                {done && !active && <View style={styles.stepDotInner} />}
              </View>
              <Text style={[styles.stepLabel, done && styles.stepLabelDone]} numberOfLines={2}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// â”€â”€â”€ Rider Marker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RiderMarker({ bearing }: { bearing: number }) {
  return (
    <View style={styles.riderOuter}>
      <View style={[styles.riderInner, { transform: [{ rotate: `${bearing}deg` }] }]}>
        <Text style={styles.riderEmoji}>ðŸ›µ</Text>
      </View>
    </View>
  );
}

// â”€â”€â”€ Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function OrderTrackingScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const mapRef    = useRef<MapView>(null);

  const [order,    setOrder]    = useState<Order | null>(null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading,  setLoading]  = useState(true);

  // Animated coords for smooth rider movement
  const riderLatAnim = useRef(new Animated.Value(0)).current;
  const riderLngAnim = useRef(new Animated.Value(0)).current;
  const [riderCoord, setRiderCoord] = useState<LatLng | null>(null);

  // Rating state
  const [ratingStars, setRatingStars]           = useState(0);
  const [ratingReview, setRatingReview]         = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted]   = useState(false);

  // Reorder state
  const [reordering, setReordering] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleCancelOrder() {
    if (!order?.id) { return; }
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await api.post(`/me/orders/${order.id}/cancel`);
              Alert.alert('Success', 'Order cancelled successfully.');
              fetchOrder();
              fetchTracking();
            } catch (error: any) {
              const msg = error.response?.data?.message || 'Could not cancel order. Please try again.';
              Alert.alert('Error', msg);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }

  async function handleReorder() {
    if (!order?.items?.length) { return; }
    setReordering(true);
    try {
      for (const item of order.items) {
        await api.post('/me/cart/items', {
          product_id: item.product_id,
          quantity: item.quantity,
        });
      }
      router.push('/(tabs)/cart' as never);
    } catch {
      Alert.alert('Error', 'Could not add items to cart. Some products may be unavailable.');
    } finally {
      setReordering(false);
    }
  }

  async function handleDownloadInvoice() {
    if (!order?.id) { return; }
    try {
      const token = await SecureStore.getItemAsync('ourth_auth_token');
      const url = `${API_BASE_URL}/me/orders/${order.id}/invoice${token ? `?token=${token}` : ''}`;
      // The invoice endpoint uses Sanctum bearer auth; open via browser
      // Pass the token as a query param requires a signed URL or we use the
      // standard auth header. Since browsers can't set headers, we open the
      // URL and rely on the session cookie or prompt the user.
      // Simplest approach: open the API URL directly and let the server handle it.
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open invoice URL on this device.');
      }
    } catch {
      Alert.alert('Error', 'Could not open invoice. Please try again.');
    }
  }

  async function handleSubmitRating() {
    if (!order?.vendor_id || ratingStars === 0) { return; }
    setRatingSubmitting(true);
    try {
      await api.post('/me/ratings', {
        ratable_type: 'vendor',
        ratable_id: order.vendor_id,
        rating: ratingStars,
        review: ratingReview || undefined,
      });
      setRatingSubmitted(true);
    } catch {
      Alert.alert('Error', 'Could not submit rating. Please try again.');
    } finally {
      setRatingSubmitting(false);
    }
  }

  // â”€â”€ Fetch order details once â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await api.get<{ success: boolean; data: Order }>(`/me/orders/${id}`);
      setOrder(data.data);
    } catch {
      // stay null
    }
  }, [id]);

  // â”€â”€ Poll tracking endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchTracking = useCallback(async () => {
    try {
      const { data } = await api.get<{ success: boolean; data: TrackingData }>(`/me/orders/${id}/tracking`);
      const td = data.data;
      setTracking(td);

      if (td.rider) {
        const newLat = td.rider.lat;
        const newLng = td.rider.lng;

        setRiderCoord((prev) => {
          if (!prev) {
            riderLatAnim.setValue(newLat);
            riderLngAnim.setValue(newLng);
            return { lat: newLat, lng: newLng };
          }
          // Animate to new position
          Animated.timing(riderLatAnim, {
            toValue: newLat,
            duration: 800,
            useNativeDriver: false,
          }).start();
          Animated.timing(riderLngAnim, {
            toValue: newLng,
            duration: 800,
            useNativeDriver: false,
          }).start();
          return { lat: newLat, lng: newLng };
        });

        // Pan camera to include rider
        if (td.pickup && mapRef.current) {
          mapRef.current.animateToRegion(
            regionFromPoints([
              td.pickup,
              { lat: newLat, lng: newLng },
            ]),
            600,
          );
        }
      }
    } catch {
      // silently ignore poll errors
    } finally {
      setLoading(false);
    }
  }, [id, riderLatAnim, riderLngAnim]);

  // â”€â”€ Initial load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    fetchOrder();
    fetchTracking();
  }, [fetchOrder, fetchTracking]);

  // â”€â”€ Polling interval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const interval = setInterval(fetchTracking, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  // â”€â”€ Initial map region â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const initialRegion: Region | undefined = tracking?.pickup
    ? regionFromPoints([
        tracking.pickup,
        riderCoord ?? deliveryFromPickup(tracking.pickup),
      ])
    : undefined;

  const deliveryCoord = tracking?.pickup ? deliveryFromPickup(tracking.pickup) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3d6b4f" />
        <Text style={styles.loadingText}>Loading trackingâ€¦</Text>
      </SafeAreaView>
    );
  }

  const display = STATUS_DISPLAY[tracking?.order_status ?? order?.order_status ?? 'pending']
    ?? { title: 'Tracking', subtitle: '' };
  const statusForProgress = tracking?.order_status ?? order?.order_status ?? 'pending';

  const subtotal       = parseFloat(order?.subtotal ?? order?.total_amount ?? '0');
  const deliveryCharge = parseFloat(order?.delivery_charge ?? '0');
  const taxAmount      = parseFloat(order?.tax_amount ?? '0');
  const discountAmount = parseFloat(order?.discount_amount ?? '0');
  const grandTotal     = parseFloat(order?.total_amount ?? '0');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f5f2' }}>

      {/* â”€â”€ Map (full width, fixed height) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View style={styles.mapWrapper}>
        {initialRegion ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={initialRegion}
            showsCompass={false}
            showsMyLocationButton={false}
            mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            {/* Pickup marker */}
            {tracking?.pickup && (
              <Marker
                coordinate={{ latitude: tracking.pickup.lat, longitude: tracking.pickup.lng }}
                title={tracking.pickup.name}
                description="Pickup point"
              >
                <View style={styles.pickupMarker}>
                  <MapPin size={16} color="#fff" />
                </View>
              </Marker>
            )}

            {/* Delivery marker */}
            {deliveryCoord && (
              <Marker
                coordinate={{ latitude: deliveryCoord.lat, longitude: deliveryCoord.lng }}
                title="Your Location"
                description="Delivery destination"
              >
                <View style={styles.deliveryMarker}>
                  <MapPin size={16} color="#fff" />
                </View>
              </Marker>
            )}

            {/* Route line: pickup â†’ rider â†’ delivery */}
            {tracking?.pickup && deliveryCoord && (
              <Polyline
                coordinates={[
                  { latitude: tracking.pickup.lat,  longitude: tracking.pickup.lng  },
                  ...(riderCoord ? [{ latitude: riderCoord.lat, longitude: riderCoord.lng }] : []),
                  { latitude: deliveryCoord.lat, longitude: deliveryCoord.lng },
                ]}
                strokeColor="#3d6b4f"
                strokeWidth={3}
                lineDashPattern={[8, 4]}
              />
            )}

            {/* Rider marker */}
            {riderCoord && (
              <Marker
                coordinate={{ latitude: riderCoord.lat, longitude: riderCoord.lng }}
                title="Your Rider"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <RiderMarker bearing={tracking?.rider?.bearing ?? 0} />
              </Marker>
            )}
          </MapView>
        ) : (
          <View style={[styles.map, styles.mapPlaceholder]}>
            <MapPin size={32} color="#3d6b4f" />
            <Text style={styles.mapPlaceholderText}>Map unavailable{'\n'}(vendor has no coordinates)</Text>
          </View>
        )}

        {/* Header overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.headerTitleText}>Order Tracking</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* ETA chip */}
        {tracking?.rider?.status_message && (
          <View style={styles.etaChip}>
            <Text style={styles.etaText}>{tracking.rider.status_message}</Text>
          </View>
        )}

        {/* Live dot */}
        {riderCoord && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* â”€â”€ Bottom sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Status card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{display.title}</Text>
              <Text style={styles.statusSubtitle}>{display.subtitle}</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View>
              <Text style={styles.metaLabel}>Order Date</Text>
              <Text style={styles.metaValue}>
                {order ? ordinalDate(order.created_at) : 'â€”'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metaLabel}>Order ID</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {order?.order_number ?? tracking?.order_number ?? `#${id}`}
              </Text>
            </View>
          </View>

          <StatusProgress status={statusForProgress} />
        </View>

        {/* Cancel Order card — only for pending orders */}
        {(tracking?.order_status ?? order?.order_status) === 'pending' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order Actions</Text>
            <Text style={styles.cancelNote}>
              You can cancel this order before the vendor starts preparing it.
            </Text>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancelOrder}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.cancelBtnText}>🚫  Cancel Order</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Items card */}
        {order?.items && order.items.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {order.items.length} Item{order.items.length !== 1 ? 's' : ''} in this order
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.itemsScroll}
            >
              {order.items.map((item) => (
                <View key={item.id} style={styles.itemThumb}>
                  {item.product?.primary_image_url ? (
                    <Image
                      source={{ uri: fixAssetUrl(item.product.primary_image_url) }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.itemImage, styles.itemImageFallback]}>
                      <Package size={24} color="#9ca3af" />
                    </View>
                  )}
                  <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={styles.itemQty}>no. of items: {item.quantity}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Billing card */}
        {order && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Billing Details</Text>

            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Items Total</Text>
              <Text style={styles.billingValue}>₹{subtotal.toFixed(0)}</Text>
            </View>
            {taxAmount > 0 && (
              <View style={styles.billingRow}>
                <Text style={styles.billingLabel}>Tax / GST</Text>
                <Text style={styles.billingValue}>₹{taxAmount.toFixed(0)}</Text>
              </View>
            )}
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Delivery Charge</Text>
              <Text style={styles.billingValue}>₹{deliveryCharge.toFixed(0)}</Text>
            </View>
            {discountAmount > 0 && (
              <View style={styles.billingRow}>
                <Text style={styles.billingLabel}>Discount</Text>
                <Text style={[styles.billingValue, { color: '#16a34a' }]}>
                  -₹{discountAmount.toFixed(0)}
                </Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.billingRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(0)}</Text>
            </View>
          </View>
        )}

        {/* Rating card — only for delivered orders */}
        {order?.order_status === 'delivered' && (
          <View style={styles.card}>
            {ratingSubmitted ? (
              <View style={styles.ratingDoneWrap}>
                <Text style={styles.ratingDoneEmoji}>⭐</Text>
                <Text style={styles.ratingDoneTitle}>Thanks for your feedback!</Text>
                <Text style={styles.ratingDoneSub}>Your rating has been submitted.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Rate your experience</Text>
                <Text style={styles.ratingSubtitle}>
                  How was your order from {order.vendor?.business_name ?? 'the vendor'}?
                </Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRatingStars(star)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Text style={[styles.starIcon, star <= ratingStars && styles.starIconActive]}>
                        ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.ratingInput}
                  placeholder="Leave a review (optional)..."
                  placeholderTextColor="#9ca3af"
                  value={ratingReview}
                  onChangeText={setRatingReview}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={[styles.ratingBtn, ratingStars === 0 && styles.ratingBtnDisabled]}
                  onPress={handleSubmitRating}
                  disabled={ratingStars === 0 || ratingSubmitting}
                >
                  {ratingSubmitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.ratingBtnText}>Submit Rating</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Reorder + Invoice buttons — only for delivered orders */}
        {order?.order_status === 'delivered' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order Actions</Text>
            <TouchableOpacity
              style={styles.reorderBtn}
              onPress={handleReorder}
              disabled={reordering}
            >
              {reordering
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.reorderBtnText}>🔄  Reorder</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.invoiceBtn}
              onPress={handleDownloadInvoice}
            >
              <Text style={styles.invoiceBtnText}>📄  Download Invoice</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.pollNote}>Updates every 5 seconds</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f5f2', gap: 12 },
  loadingText:      { color: '#6b7280', fontSize: 14 },

  // Map
  mapWrapper:  { height: MAP_HEIGHT, position: 'relative' },
  map:         { flex: 1 },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5', gap: 8 },
  mapPlaceholderText: { color: '#3d6b4f', textAlign: 'center', fontSize: 13 },

  // Header overlay
  headerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 12 : 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backCircle:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  headerTitle:     { backgroundColor: 'rgba(255,255,255,0.88)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  headerTitleText: { fontSize: 15, fontWeight: '700', color: '#1f2937' },

  // ETA & live chips
  etaChip: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  etaText: { fontSize: 13, fontWeight: '600', color: '#1f2937' },

  liveBadge: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 60 : 48,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 4,
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  // Markers
  pickupMarker:   { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3d6b4f', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 },
  deliveryMarker: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 },
  riderOuter:     { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  riderInner:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  riderEmoji:     { fontSize: 24 },

  // Sheet
  sheet:        { flex: 1, backgroundColor: '#f0f5f2' },
  sheetContent: { padding: 16, gap: 12, paddingBottom: 32 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  // Status
  statusRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  statusTitle:   { fontSize: 17, fontWeight: '700', color: '#1f2937' },
  statusSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  metaGrid:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metaLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  metaValue: { fontSize: 13, fontWeight: '600', color: '#1f2937', maxWidth: 160 },

  // Progress
  progressWrap:  { gap: 6 },
  progressTrack: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressFill:  { height: '100%', backgroundColor: '#3d6b4f', borderRadius: 3 },
  stepsRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem:      { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#e5e7eb', borderWidth: 1.5, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  stepDotDone:   { backgroundColor: '#3d6b4f', borderColor: '#3d6b4f' },
  stepDotActive: { backgroundColor: '#fff', borderColor: '#3d6b4f', borderWidth: 2.5 },
  stepDotInner:  { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  stepLabel:     { fontSize: 9, color: '#9ca3af', textAlign: 'center', lineHeight: 12 },
  stepLabelDone: { color: '#374151', fontWeight: '600' },

  // Items
  sectionTitle:      { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  itemsScroll:       { gap: 10, paddingRight: 4 },
  itemThumb:         { width: 80, alignItems: 'center', gap: 4 },
  itemImage:         { width: 72, height: 72, borderRadius: 12, backgroundColor: '#f3f4f6' },
  itemImageFallback: { alignItems: 'center', justifyContent: 'center' },
  itemName:          { fontSize: 10, color: '#374151', fontWeight: '600', textAlign: 'center' },
  itemQty:           { fontSize: 9, color: '#9ca3af', textAlign: 'center' },

  // Billing
  billingRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  billingLabel:    { fontSize: 14, color: '#374151' },
  billingValue:    { fontSize: 14, color: '#374151', fontWeight: '500' },
  divider:         { height: 1, backgroundColor: '#e5e7eb', marginVertical: 6 },
  grandTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  grandTotalValue: { fontSize: 16, fontWeight: '700', color: '#1f2937' },

  pollNote: { fontSize: 11, color: '#9ca3af', textAlign: 'center', paddingBottom: 4 },

  // Rating card
  ratingSubtitle:   { fontSize: 13, color: '#6b7280', marginBottom: 14 },
  starsRow:         { flexDirection: 'row', gap: 10, marginBottom: 16 },
  starIcon:         { fontSize: 32, color: '#d1d5db' },
  starIconActive:   { color: '#f59e0b' },
  ratingInput:      { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#1f2937', minHeight: 72, textAlignVertical: 'top', marginBottom: 14 },
  ratingBtn:        { backgroundColor: '#3d6b4f', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ratingBtnDisabled:{ backgroundColor: '#9ca3af' },
  ratingBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  ratingDoneWrap:   { alignItems: 'center', paddingVertical: 12, gap: 6 },
  ratingDoneEmoji:  { fontSize: 36 },
  ratingDoneTitle:  { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  ratingDoneSub:    { fontSize: 13, color: '#6b7280' },

  // Reorder + invoice
  reorderBtn:     { backgroundColor: '#3d6b4f', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  reorderBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  invoiceBtn:     { borderWidth: 1.5, borderColor: '#3d6b4f', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  invoiceBtnText: { color: '#3d6b4f', fontWeight: '700', fontSize: 15 },

  // Cancel Order
  cancelNote:    { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  cancelBtn:     { backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
