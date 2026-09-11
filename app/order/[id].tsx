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
import { ChevronLeft, Package, MapPin, Star } from '@/components/icons';
import api, { fixAssetUrl, orderAPI } from '@/lib/api';
import { isExpoGo } from '@/lib/pushNotifications';
import type { Order } from '@/lib/types';
import { LinearGradient } from 'expo-linear-gradient';

let RazorpayCheckout: any = null;
try {
  RazorpayCheckout = require('react-native-razorpay').default;
} catch (e) {
  // Silent fallback when running in Expo Go without native modules
}

const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '';

function getPaymentErrorMessage(err: unknown): string {
  if (typeof err === 'string') {
    try {
      const parsed = JSON.parse(err);
      if (parsed?.error?.description && parsed.error.description !== 'undefined') {
        return parsed.error.description;
      }
      if (parsed?.error?.reason) {
        return `Payment failed (${parsed.error.reason.replace(/_/g, ' ')}). Please try again or switch to COD.`;
      }
    } catch {
      // not JSON string
    }
    return err;
  }
  if (err && typeof err === 'object') {
    const maybeError = err as { message?: unknown; description?: unknown; code?: unknown; error?: any };
    if (maybeError.error?.description && maybeError.error.description !== 'undefined') {
      return maybeError.error.description;
    }
    if (maybeError.error?.reason) {
      return `Payment failed (${maybeError.error.reason.replace(/_/g, ' ')}). Please try again or switch to COD.`;
    }
    const message = typeof maybeError.message === 'string' && maybeError.message.trim()
      ? maybeError.message.trim()
      : typeof maybeError.description === 'string' && maybeError.description.trim()
        ? maybeError.description.trim()
        : '';
    if (message && !message.startsWith('{')) return message;
    if (typeof maybeError.code === 'string' && maybeError.code.trim()) return maybeError.code.trim();
  }
  return 'Payment failed or was cancelled. Please try paying online again or change to Cash on Delivery.';
}

const { width: W } = Dimensions.get('window');
const POLL_MS = 10000;

// ─── Timeline steps ───────────────────────────────────────────────────────────

const STATUS_STEPS = [
  'pending',
  'confirmed',
  'processing',
  'out_for_delivery',
  'delivered',
] as const;

const STEP_CONFIG: Record<string, { label: string; sublabel: string; emoji: string }> = {
  pending:          { label: 'Order Placed',       sublabel: 'Your order has been received',      emoji: '📦' },
  confirmed:        { label: 'Confirmed',           sublabel: 'Vendor is preparing your order',    emoji: '✅' },
  processing:       { label: 'Packed & Ready',      sublabel: 'Your order is packed and ready',    emoji: '🎁' },
  out_for_delivery: { label: 'Out for Delivery',    sublabel: 'Rider is on the way to you',        emoji: '🛵' },
  delivered:        { label: 'Delivered',           sublabel: 'Order delivered successfully!',     emoji: '🎉' },
};

function ordinalDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const mod100 = day % 100;
  const mod10 = day % 10;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? 'th'
      : mod10 === 1 ? 'st'
        : mod10 === 2 ? 'nd'
          : mod10 === 3 ? 'rd'
            : 'th';
  const month = d.toLocaleString('en', { month: 'short' });
  return `${day}${suffix} ${month}, ${d.getFullYear()}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Timeline Component ───────────────────────────────────────────────────────

function OrderTimeline({ order }: { order: Order }) {
  const status = order.order_status;
  const isCancelled = status === 'cancelled';
  const isPendingPayment = order.payment_status === 'pending' && status === 'pending';
  const currentIndex = STATUS_STEPS.indexOf(status as any);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (isCancelled) {
    return (
      <View style={tl.cancelledBox}>
        <Text style={tl.cancelledEmoji}>❌</Text>
        <Text style={tl.cancelledTitle}>Order Cancelled</Text>
        {order.cancellation_reason ? (
          <Text style={tl.cancelledReason}>Reason: {order.cancellation_reason}</Text>
        ) : null}
        {order.cancelled_at ? (
          <Text style={tl.cancelledDate}>{ordinalDate(order.cancelled_at)} · {formatTime(order.cancelled_at)}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={tl.wrap}>
      {STATUS_STEPS.map((step, i) => {
        const cfg = STEP_CONFIG[step];
        const isDone = currentIndex >= i && !isCancelled;
        const isActive = currentIndex === i && !isCancelled;
        const isLast = i === STATUS_STEPS.length - 1;

        // Get timestamp for done steps
        let timestamp: string | null = null;
        if (isDone) {
          if (step === 'pending' && order.created_at) timestamp = ordinalDate(order.created_at) + ' · ' + formatTime(order.created_at);
          if (step === 'confirmed' && (order as any).confirmed_at) timestamp = ordinalDate((order as any).confirmed_at) + ' · ' + formatTime((order as any).confirmed_at);
          if (step === 'processing' && (order as any).dispatched_at) timestamp = ordinalDate((order as any).dispatched_at) + ' · ' + formatTime((order as any).dispatched_at);
          if (step === 'out_for_delivery' && (order as any).dispatched_at) timestamp = 'In Transit';
          if (step === 'delivered' && order.delivered_at) timestamp = ordinalDate(order.delivered_at) + ' · ' + formatTime(order.delivered_at);
        }

        return (
          <View key={step} style={tl.row}>
            {/* Left: dot + line */}
            <View style={tl.dotCol}>
              {isActive ? (
                <Animated.View style={[tl.dotActive, { transform: [{ scale: pulseAnim }] }]}>
                  <Text style={{ fontSize: 13 }}>{cfg.emoji}</Text>
                </Animated.View>
              ) : isDone ? (
                <View style={tl.dotDone}>
                  <Text style={{ fontSize: 12 }}>✓</Text>
                </View>
              ) : (
                <View style={tl.dotPending} />
              )}
              {!isLast && (
                <View style={[tl.line, isDone && tl.lineDone]} />
              )}
            </View>

            {/* Right: content */}
            <View style={[tl.content, isLast && { paddingBottom: 0 }]}>
              <Text style={[tl.stepLabel, isDone && tl.stepLabelDone, isActive && tl.stepLabelActive]}>
                {cfg.label}
              </Text>
              <Text style={[tl.stepSub, isActive && tl.stepSubActive]}>
                {isActive ? cfg.sublabel : isDone ? (timestamp ?? cfg.sublabel) : cfg.sublabel}
              </Text>
              {isActive && timestamp && (
                <Text style={tl.timestamp}>{timestamp}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── AWB / Tracking Link ──────────────────────────────────────────────────────

function TrackingLink({ order }: { order: Order }) {
  const awb = (order as any).awb_number;
  const url = (order as any).tracking_url;
  if (!awb && !url) return null;
  return (
    <View style={s.trackLinkBox}>
      <Text style={s.trackLinkLabel}>🚚 Rider Tracking</Text>
      {awb && <Text style={s.trackLinkAwb}>AWB: {awb}</Text>}
      {url && (
        <TouchableOpacity onPress={() => Linking.openURL(url)} activeOpacity={0.75} style={s.trackLinkBtn}>
          <Text style={s.trackLinkBtnText}>Open Tracking Link →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} activeOpacity={0.7}>
          <Text style={{ fontSize: 28, color: n <= value ? '#f59e0b' : '#d1d5db' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const [ratingStars, setRatingStars] = useState(0);
  const [ratingReview, setRatingReview] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const [reordering, setReordering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [payingOnline, setPayingOnline] = useState(false);
  const [switchingCod, setSwitchingCod] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await api.get<{ success: boolean; data: Order }>(`/me/orders/${id}`);
      setOrder(data.data);
    } catch {
      /* silently handled */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
    pollRef.current = setInterval(fetchOrder, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrder]);

  // Stop polling when delivered or cancelled
  useEffect(() => {
    if (order?.order_status === 'delivered' || order?.order_status === 'cancelled') {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [order?.order_status]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handlePayOnline() {
    if (!order?.id) return;
    const isRazorpayModuleReady = typeof (RazorpayCheckout as { open?: unknown })?.open === 'function';
    if (isExpoGo || !isRazorpayModuleReady) {
      Alert.alert('UPI Not Available', 'UPI/online payment requires a production build with Razorpay native module.');
      return;
    }
    setPayingOnline(true);
    try {
      const initiateRes = await orderAPI.initiateRazorpayPayment(order.id);
      const initiateData = initiateRes.data?.data ?? initiateRes.data;
      const razorpayKey = initiateData.key ?? RAZORPAY_KEY_ID;
      if (!razorpayKey) throw new Error('Razorpay key is not configured.');

      let razorpayResponse;
      try {
        razorpayResponse = await RazorpayCheckout.open({
          key: razorpayKey,
          amount: initiateData.amount,
          currency: initiateData.currency,
          name: 'OURTH',
          description: `Order #${order.order_number ?? order.id}`,
          order_id: initiateData.razorpay_order_id,
          prefill: { contact: (order as any).delivery_phone ?? '', name: (order as any).delivery_name ?? '' },
          theme: { color: '#1a6b5a' },
        });
      } catch (paymentErr) {
        const msg = getPaymentErrorMessage(paymentErr);
        if (/cancel|dismiss|back/i.test(msg)) throw new Error('Payment cancelled by user.');
        throw new Error(msg);
      }

      await orderAPI.verifyRazorpayPayment(order.id, {
        razorpay_order_id: razorpayResponse.razorpay_order_id ?? initiateData.razorpay_order_id,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature: razorpayResponse.razorpay_signature,
      });
      Alert.alert('Payment Successful 🎉', 'Your payment has been received!');
      fetchOrder();
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : getPaymentErrorMessage(err);
      const isCancelled = rawMsg === 'Payment cancelled by user.';
      Alert.alert(
        isCancelled ? 'Payment Cancelled' : 'Payment Failed',
        isCancelled ? 'Payment cancelled. You can try again or switch to Cash on Delivery.' : `Payment could not be completed.\n\n${rawMsg}`,
        [
          { text: 'Try Again', onPress: handlePayOnline },
          { text: 'Switch to COD', onPress: handleSwitchToCod },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } finally {
      setPayingOnline(false);
    }
  }

  async function handleSwitchToCod() {
    if (!order?.id) return;
    Alert.alert('Switch to Cash on Delivery', 'Change payment method to COD for this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change to COD',
        onPress: async () => {
          setSwitchingCod(true);
          try {
            await api.post(`/me/orders/${order.id}/switch-cod`);
            Alert.alert('Updated', 'Payment method changed to Cash on Delivery.');
            fetchOrder();
          } catch {
            Alert.alert('Error', 'Could not switch to COD. Please contact support.');
          } finally {
            setSwitchingCod(false);
          }
        },
      },
    ]);
  }

  async function handleCancelOrder() {
    if (!order?.id || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.post(`/me/orders/${order.id}/cancel`, { reason: cancelReason.trim() });
      setShowCancelModal(false);
      setCancelReason('');
      Alert.alert('Cancelled', 'Your order has been cancelled.');
      fetchOrder();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not cancel order.');
    } finally {
      setCancelling(false);
    }
  }

  async function handleReorder() {
    if (!order?.items?.length) return;
    setReordering(true);
    try {
      for (const item of order.items) {
        await api.post('/me/cart/items', {
          product_id: item.product_id,
          product_pack_id: item.product_pack_id ?? undefined,
          quantity: item.quantity,
        });
      }
      Alert.alert('Added to Cart', 'Items added to your cart.', [
        { text: 'Go to Cart', onPress: () => router.push('/(tabs)/cart') },
        { text: 'OK' },
      ]);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not reorder.');
    } finally {
      setReordering(false);
    }
  }

  async function handleSubmitRating() {
    if (!order?.id || ratingStars === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }
    setRatingSubmitting(true);
    try {
      await api.post(`/me/orders/${order.id}/rating`, { stars: ratingStars, review: ratingReview.trim() || undefined });
      setRatingSubmitted(true);
    } catch {
      Alert.alert('Error', 'Could not submit rating. Please try again.');
    } finally {
      setRatingSubmitting(false);
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color="#1a6b5a" />
        <Text style={s.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={s.loadingScreen}>
        <Package size={48} color="#d1d5db" />
        <Text style={s.loadingText}>Order not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isPendingPayment = order.payment_status === 'pending' && order.order_status === 'pending';
  const isActive = !['delivered', 'cancelled'].includes(order.order_status);
  const isCancellable = order.order_status === 'pending';
  const isDelivered = order.order_status === 'delivered';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBack} onPress={() => router.back()} activeOpacity={0.8}>
          <ChevronLeft size={22} color="#1f2937" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Order Details</Text>
          <Text style={s.headerSub} numberOfLines={1}>{order.order_number || `#${order.id}`}</Text>
        </View>
        {isActive && (
          <View style={s.livePill}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* Status Hero */}
        <View style={s.heroBox}>
          <LinearGradient
            colors={
              order.order_status === 'delivered'
                ? ['#1a4731', '#2d6a4f']
                : order.order_status === 'cancelled'
                  ? ['#7f1d1d', '#991b1b']
                  : ['#1a3a6b', '#1a6b5a']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={s.heroEmoji}>
            {order.order_status === 'delivered' ? '🎉'
              : order.order_status === 'cancelled' ? '❌'
              : order.order_status === 'out_for_delivery' ? '🛵'
              : order.order_status === 'processing' ? '🎁'
              : order.order_status === 'confirmed' ? '✅'
              : '📦'}
          </Text>
          <Text style={s.heroTitle}>
            {order.order_status === 'delivered' ? 'Delivered!'
              : order.order_status === 'cancelled' ? 'Order Cancelled'
              : order.order_status === 'out_for_delivery' ? 'On the Way!'
              : order.order_status === 'processing' ? 'Packed & Ready'
              : order.order_status === 'confirmed' ? 'Being Prepared'
              : 'Order Placed'}
          </Text>
          <View style={s.heroMeta}>
            <Text style={s.heroMetaText}>📅 {ordinalDate(order.created_at)}</Text>
            <View style={s.heroMetaDivider} />
            <View style={[
              s.heroBadge,
              order.payment_status === 'paid' ? s.heroBadgePaid : s.heroBadgePending,
            ]}>
              <Text style={[
                s.heroBadgeText,
                order.payment_status === 'paid' ? s.heroBadgeTextPaid : s.heroBadgeTextPending,
              ]}>
                {order.payment_status === 'paid' ? '💳 Paid' : '⏳ Payment Pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* Pending Payment CTA */}
        {isPendingPayment && (
          <View style={s.payAlertBox}>
            <Text style={s.payAlertTitle}>⚠️ Complete Payment</Text>
            <Text style={s.payAlertSub}>Your order is held until payment is confirmed.</Text>
            <View style={s.payBtnRow}>
              <TouchableOpacity
                style={[s.payBtnPrimary, payingOnline && s.btnDisabled]}
                onPress={handlePayOnline}
                disabled={payingOnline}
                activeOpacity={0.8}
              >
                {payingOnline ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.payBtnPrimaryText}>Pay Online</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.payBtnSecondary, switchingCod && s.btnDisabled]}
                onPress={handleSwitchToCod}
                disabled={switchingCod}
                activeOpacity={0.8}
              >
                {switchingCod ? (
                  <ActivityIndicator color="#1a6b5a" size="small" />
                ) : (
                  <Text style={s.payBtnSecondaryText}>Switch to COD</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Order Progress</Text>
          <OrderTimeline order={order} />
        </View>

        {/* AWB / Tracking Link */}
        <TrackingLink order={order} />

        {/* Order Items */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Items Ordered</Text>
          <View style={s.itemsList}>
            {(order.items ?? []).map((item) => (
              <View key={item.id} style={s.itemRow}>
                {item.product?.primary_image_url ? (
                  <Image
                    source={{ uri: fixAssetUrl(item.product.primary_image_url) }}
                    style={s.itemImg}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[s.itemImg, s.itemImgPlaceholder]}>
                    <Package size={20} color="#9ca3af" />
                  </View>
                )}
                <View style={s.itemInfo}>
                  <Text style={s.itemName} numberOfLines={2}>{item.product?.name ?? 'Product'}</Text>
                  {item.productPack?.name && (
                    <Text style={s.itemPack}>{item.productPack.name}</Text>
                  )}
                  <Text style={s.itemQty}>Qty: {item.quantity}</Text>
                </View>
                <Text style={s.itemPrice}>₹{Number(item.total_price).toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Price Summary</Text>
          <View style={s.priceBox}>
            {order.subtotal && (
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Subtotal</Text>
                <Text style={s.priceValue}>₹{Number(order.subtotal).toLocaleString('en-IN')}</Text>
              </View>
            )}
            {order.discount_amount && Number(order.discount_amount) > 0 && (
              <View style={s.priceRow}>
                <Text style={[s.priceLabel, { color: '#16a34a' }]}>Discount</Text>
                <Text style={[s.priceValue, { color: '#16a34a' }]}>- ₹{Number(order.discount_amount).toLocaleString('en-IN')}</Text>
              </View>
            )}
            {order.delivery_charge && (
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Delivery</Text>
                <Text style={s.priceValue}>
                  {Number(order.delivery_charge) === 0 ? 'FREE' : `₹${Number(order.delivery_charge).toLocaleString('en-IN')}`}
                </Text>
              </View>
            )}
            <View style={[s.priceRow, s.priceTotalRow]}>
              <Text style={s.priceTotalLabel}>Total Paid</Text>
              <Text style={s.priceTotalValue}>₹{Number(order.total_amount).toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Address */}
        {(order as any).delivery_address_line1 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Delivery Address</Text>
            <View style={s.addressBox}>
              <MapPin size={16} color="#6b7280" />
              <Text style={s.addressText}>
                {(order as any).delivery_address_line1}
                {(order as any).delivery_address_line2 ? `, ${(order as any).delivery_address_line2}` : ''}
                {(order as any).delivery_city ? `, ${(order as any).delivery_city}` : ''}
                {(order as any).delivery_state ? `, ${(order as any).delivery_state}` : ''}
                {(order as any).delivery_postal_code ? ` - ${(order as any).delivery_postal_code}` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Rating */}
        {isDelivered && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Rate Your Order</Text>
            {ratingSubmitted ? (
              <View style={s.ratingDoneBox}>
                <Text style={s.ratingDoneEmoji}>🌟</Text>
                <Text style={s.ratingDoneText}>Thank you for your feedback!</Text>
              </View>
            ) : (
              <View style={s.ratingBox}>
                <StarRating value={ratingStars} onChange={setRatingStars} />
                <TextInput
                  style={s.ratingInput}
                  value={ratingReview}
                  onChangeText={setRatingReview}
                  placeholder="Share your experience (optional)"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[s.ratingSubmitBtn, ratingSubmitting && s.btnDisabled]}
                  onPress={handleSubmitRating}
                  disabled={ratingSubmitting}
                  activeOpacity={0.8}
                >
                  {ratingSubmitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.ratingSubmitText}>Submit Rating</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.actionBtnReorder, reordering && s.btnDisabled]}
            onPress={handleReorder}
            disabled={reordering}
            activeOpacity={0.8}
          >
            {reordering
              ? <ActivityIndicator color="#1a6b5a" size="small" />
              : <Text style={s.actionBtnReorderText}>🔄 Order Again</Text>
            }
          </TouchableOpacity>
          {isCancellable && (
            <TouchableOpacity
              style={s.actionBtnCancel}
              onPress={() => setShowCancelModal(true)}
              activeOpacity={0.8}
            >
              <Text style={s.actionBtnCancelText}>Cancel Order</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Cancel Modal */}
      {showCancelModal && (
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Cancel Order</Text>
            <Text style={s.modalSub}>Please tell us why you want to cancel.</Text>
            <Text style={s.modalLabel}>Reason</Text>
            <TextInput
              style={s.modalInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="e.g. Changed my mind, wrong item..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={s.modalBtnKeep}
                onPress={() => { setShowCancelModal(false); setCancelReason(''); }}
                activeOpacity={0.8}
              >
                <Text style={s.modalBtnKeepText}>Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtnConfirm, (!cancelReason.trim() || cancelling) && s.btnDisabled]}
                onPress={handleCancelOrder}
                disabled={!cancelReason.trim() || cancelling}
                activeOpacity={0.8}
              >
                {cancelling
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.modalBtnConfirmText}>Cancel Order</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Timeline Styles ──────────────────────────────────────────────────────────

const tl = StyleSheet.create({
  wrap: { paddingTop: 4 },

  row: { flexDirection: 'row', gap: 16 },

  dotCol: { alignItems: 'center', width: 36 },

  dotDone: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1a6b5a',
    alignItems: 'center', justifyContent: 'center',
  },
  dotActive: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#fff',
    borderWidth: 3, borderColor: '#1a6b5a',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1a6b5a', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  dotPending: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f3f4f6',
    borderWidth: 2, borderColor: '#e5e7eb',
    margin: 4,
  },

  line: {
    flex: 1, width: 2,
    backgroundColor: '#e5e7eb',
    minHeight: 28, marginVertical: 4,
  },
  lineDone: { backgroundColor: '#1a6b5a' },

  content: { flex: 1, paddingBottom: 24 },
  stepLabel: { fontSize: 14, fontWeight: '600', color: '#9ca3af', marginTop: 6 },
  stepLabelDone: { color: '#374151' },
  stepLabelActive: { fontSize: 16, fontWeight: '700', color: '#1a6b5a' },
  stepSub: { fontSize: 12, color: '#d1d5db', marginTop: 2 },
  stepSubActive: { color: '#6b7280' },
  timestamp: { fontSize: 11, color: '#9ca3af', marginTop: 4 },

  cancelledBox: {
    alignItems: 'center', paddingVertical: 24,
    backgroundColor: '#fef2f2', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#fca5a5',
  },
  cancelledEmoji: { fontSize: 40, marginBottom: 8 },
  cancelledTitle: { fontSize: 18, fontWeight: '700', color: '#dc2626' },
  cancelledReason: { fontSize: 13, color: '#ef4444', marginTop: 6, textAlign: 'center', paddingHorizontal: 16 },
  cancelledDate: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },

  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', gap: 12 },
  loadingText: { fontSize: 15, color: '#6b7280' },
  backBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#1a6b5a', borderRadius: 10 },
  backBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  headerBack: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: '#86efac',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16a34a' },
  liveText: { fontSize: 11, fontWeight: '800', color: '#15803d', letterSpacing: 1 },

  scrollContent: { paddingBottom: 32 },

  // Hero
  heroBox: {
    margin: 16, borderRadius: 18, padding: 24,
    alignItems: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  heroEmoji: { fontSize: 48, marginBottom: 10 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 12 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroMetaText: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  heroMetaDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.3)' },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroBadgePaid: { backgroundColor: 'rgba(22,163,74,0.25)' },
  heroBadgePending: { backgroundColor: 'rgba(245,158,11,0.25)' },
  heroBadgeText: { fontSize: 12, fontWeight: '700' },
  heroBadgeTextPaid: { color: '#86efac' },
  heroBadgeTextPending: { color: '#fde68a' },

  // Pay alert
  payAlertBox: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#fffbeb', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#fde68a', padding: 16,
  },
  payAlertTitle: { fontSize: 15, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  payAlertSub: { fontSize: 13, color: '#b45309', marginBottom: 12 },
  payBtnRow: { flexDirection: 'row', gap: 10 },
  payBtnPrimary: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: '#1a6b5a', alignItems: 'center',
  },
  payBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  payBtnSecondary: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#1a6b5a', alignItems: 'center',
  },
  payBtnSecondaryText: { color: '#1a6b5a', fontWeight: '700', fontSize: 14 },

  // Section
  section: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#fff', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },

  // AWB / tracking link
  trackLinkBox: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#eff6ff', borderRadius: 14,
    borderWidth: 1, borderColor: '#bfdbfe', padding: 14,
  },
  trackLinkLabel: { fontSize: 14, fontWeight: '700', color: '#1d4ed8', marginBottom: 4 },
  trackLinkAwb: { fontSize: 12, color: '#3b82f6', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 8 },
  trackLinkBtn: {
    backgroundColor: '#2563eb', paddingVertical: 9, paddingHorizontal: 16,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  trackLinkBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Items
  itemsList: { gap: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemImg: {
    width: 58, height: 58, borderRadius: 10,
    backgroundColor: '#f9fafb', overflow: 'hidden',
  },
  itemImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  itemPack: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  itemQty: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#111827' },

  // Price box
  priceBox: { gap: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontSize: 13, color: '#6b7280' },
  priceValue: { fontSize: 13, color: '#374151', fontWeight: '600' },
  priceTotalRow: {
    marginTop: 8, paddingTop: 10,
    borderTopWidth: 1.5, borderTopColor: '#f3f4f6',
  },
  priceTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  priceTotalValue: { fontSize: 16, fontWeight: '800', color: '#1a6b5a' },

  // Address
  addressBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  addressText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },

  // Rating
  ratingBox: { gap: 14 },
  ratingInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#374151',
    backgroundColor: '#f9fafb', minHeight: 80,
  },
  ratingSubmitBtn: {
    backgroundColor: '#1a6b5a', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  ratingSubmitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ratingDoneBox: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  ratingDoneEmoji: { fontSize: 36 },
  ratingDoneText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 16 },
  actionBtnReorder: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#1a6b5a', alignItems: 'center',
    backgroundColor: '#f0fdf4',
  },
  actionBtnReorderText: { fontSize: 14, fontWeight: '700', color: '#1a6b5a' },
  actionBtnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#dc2626', alignItems: 'center',
    backgroundColor: '#fff5f5',
  },
  actionBtnCancelText: { fontSize: 14, fontWeight: '700', color: '#dc2626' },

  btnDisabled: { opacity: 0.5 },

  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end', zIndex: 99,
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#374151',
    backgroundColor: '#f9fafb', minHeight: 90, marginBottom: 20,
  },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  modalBtnKeep: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center',
  },
  modalBtnKeepText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalBtnConfirm: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#dc2626', alignItems: 'center',
  },
  modalBtnConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
