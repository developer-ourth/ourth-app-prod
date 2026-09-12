import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronLeft, MapPin, CheckCircle, ShieldCheck } from '@/components/icons';
import { addressAPI, orderAPI } from '@/lib/api';
import { useCartStore } from '@/lib/cartStore';
import { useAuthStore } from '@/lib/store';
import { isExpoGo } from '@/lib/pushNotifications';
import type { Address } from '@/lib/types';

let RazorpayCheckout: any = null;
try {
  RazorpayCheckout = require('react-native-razorpay').default;
} catch (e) {
  // Fallback if native module not linked in Expo Go
}

const BG_IMAGE = require('../assets/Frame16.png');
const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '';

function getPaymentErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const maybeError = err as { message?: unknown; description?: unknown; code?: unknown };
    const message = typeof maybeError.message === 'string' && maybeError.message.trim()
      ? maybeError.message.trim()
      : typeof maybeError.description === 'string' && maybeError.description.trim()
        ? maybeError.description.trim()
        : '';
    if (message) return message;
    if (typeof maybeError.code === 'string' && maybeError.code.trim()) return maybeError.code.trim();
  }
  return 'Could not complete payment. Please try again.';
}

export default function PaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const addressId = params.addressId ? Number(params.addressId) : null;
  const useGreenPoints = params.useGreenPoints === 'true';

  const { cart, fetchCart, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const isB2B = false;

  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<'upi' | 'cod'>('upi');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!cart) {
      fetchCart();
    }
  }, []);

  useEffect(() => {
    async function loadSelectedAddress() {
      try {
        const res = await addressAPI.list();
        const list: Address[] = res.data?.data ?? res.data ?? [];
        if (addressId) {
          const match = list.find((a) => a.id === addressId);
          if (match) {
            setSelectedAddress(match);
            return;
          }
        }
        setSelectedAddress(list.find((a) => a.is_default) ?? list[0] ?? null);
      } catch {}
    }
    loadSelectedAddress();
  }, [addressId]);

  const total = cart?.total_amount ?? '0';

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Missing', 'Please select a delivery address to proceed.');
      return;
    }

    const isCod = selectedPayment === 'cod';
    const isRazorpayModuleReady = typeof (RazorpayCheckout as { open?: unknown })?.open === 'function';

    if (!isCod && (isExpoGo || !isRazorpayModuleReady)) {
      Alert.alert(
        'UPI Not Available',
        'UPI / Online Payment requires a native build with Razorpay. Please choose Cash on Delivery or use a dev build.',
      );
      return;
    }

    setPlacing(true);
    let createdOrderId: number | null = null;
    try {
      const orderRes = await orderAPI.placeOrder({
        delivery_address_line1: selectedAddress.address_line1,
        delivery_address_line2: selectedAddress.address_line2,
        delivery_city:         selectedAddress.city         ?? '',
        delivery_state:        selectedAddress.state        ?? '',
        delivery_postal_code:  selectedAddress.postal_code  ?? '',
        delivery_phone:        selectedAddress.mobile       ?? '',
        payment_method:        isCod ? 'cod' : 'upi',
        order_type:            isB2B ? 'b2b' : 'b2c',
        buyer_gstin:           isB2B ? (user as any).vendor?.gstin : undefined,
        use_green_points:      useGreenPoints,
        source:                'app',
      });

      const createdOrder = orderRes.data?.data ?? orderRes.data;
      createdOrderId = createdOrder?.id ?? null;

      if (!createdOrderId) {
        throw new Error('Order created but missing order id for payment.');
      }

      if (!isCod) {
        const initiateRes = await orderAPI.initiateRazorpayPayment(createdOrderId);
        const initiateData = initiateRes.data?.data ?? initiateRes.data;
        const razorpayKey = initiateData.key ?? RAZORPAY_KEY_ID;

        if (!razorpayKey) {
          throw new Error('Razorpay is not configured.');
        }

        let razorpayResponse;
        try {
          razorpayResponse = await RazorpayCheckout.open({
            key: razorpayKey,
            amount: initiateData.amount,
            currency: initiateData.currency,
            name: 'OURTH',
            description: `Order #${createdOrder.order_number ?? createdOrderId}`,
            order_id: initiateData.razorpay_order_id,
            prefill: {
              contact: selectedAddress.mobile ?? '',
              name: selectedAddress.name,
            },
            theme: { color: '#166534' },
          });
        } catch (paymentErr) {
          const paymentMessage = getPaymentErrorMessage(paymentErr);
          if (/cancel|dismiss|back/i.test(paymentMessage)) {
            throw new Error('Payment cancelled by user.');
          }
          throw new Error(paymentMessage);
        }

        try {
          await orderAPI.verifyRazorpayPayment(createdOrderId, {
            razorpay_order_id: razorpayResponse.razorpay_order_id ?? initiateData.razorpay_order_id,
            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
            razorpay_signature: razorpayResponse.razorpay_signature,
          });
        } catch (verifyErr) {
          throw new Error(`Payment verification failed: ${getPaymentErrorMessage(verifyErr)}`);
        }
      }

      await clearCart();
      router.replace('/(tabs)/orders');
      Alert.alert('Order Confirmed 🎉', isCod ? 'Your order has been placed successfully via Cash on Delivery.' : 'Payment successful and your order has been placed!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not place order. Please try again.';

      if (!isCod && createdOrderId) {
        if (msg === 'Payment cancelled by user.') {
          Alert.alert(
            'Payment Cancelled ⚠️',
            'You cancelled the Razorpay payment window. Your order has been saved with pending payment.',
            [
              { text: 'View Orders', onPress: () => router.replace('/(tabs)/orders') },
              { text: 'OK', style: 'cancel' },
            ],
          );
          return;
        }

        Alert.alert(
          'Payment Failed ❌',
          `Payment processing failed: ${msg}`,
          [
            { text: 'View Orders', onPress: () => router.replace('/(tabs)/orders') },
            { text: 'OK', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('Order Failed', msg);
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <ImageBackground source={BG_IMAGE} style={styles.screen} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Payment Method</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Amazon style delivery summary banner */}
          {selectedAddress && (
            <View style={styles.summaryCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MapPin size={20} color="#166534" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>DELIVERING TO</Text>
                  <Text style={styles.summaryName}>{selectedAddress.name}</Text>
                  <Text style={styles.summaryAddress} numberOfLines={2}>
                    {[selectedAddress.address_line1, selectedAddress.address_line2, selectedAddress.city, selectedAddress.postal_code].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Amount Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Total Payable Amount</Text>
            <Text style={styles.amountValue}>₹{total}</Text>
          </View>

          {/* Payment Method Selection (Amazon Style Radio Cards) */}
          <Text style={styles.sectionHeading}>PAYMENT OPTIONS</Text>

          {/* UPI / Paytm Option */}
          <TouchableOpacity
            style={[styles.paymentCard, selectedPayment === 'upi' && styles.paymentCardActive]}
            activeOpacity={0.85}
            onPress={() => setSelectedPayment('upi')}
          >
            <View style={styles.radioCircle}>
              {selectedPayment === 'upi' && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.paymentOptionTitle}>Online Payment (UPI / Cards / Paytm / NetBanking)</Text>
              </View>
              <Text style={styles.paymentOptionSub}>⚡ Fast, secure payment powered by Razorpay</Text>
              <View style={styles.badgeRow}>
                <Text style={styles.recommendedBadge}>RECOMMENDED</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Cash on Delivery Option */}
          <TouchableOpacity
            style={[styles.paymentCard, selectedPayment === 'cod' && styles.paymentCardActive]}
            activeOpacity={0.85}
            onPress={() => setSelectedPayment('cod')}
          >
            <View style={styles.radioCircle}>
              {selectedPayment === 'cod' && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.paymentOptionTitle}>Cash on Delivery (COD)</Text>
              <Text style={styles.paymentOptionSub}>Pay with cash or UPI when your order reaches your doorstep</Text>
            </View>
          </TouchableOpacity>

          {/* Trust Banner */}
          <View style={styles.trustBanner}>
            <ShieldCheck size={18} color="#166534" />
            <Text style={styles.trustText}>100% Safe & Secure Payments</Text>
          </View>
        </ScrollView>

        {/* Bottom Pinned Action Bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
          <View style={styles.totalBlock}>
            <Text style={styles.bottomTotalLabel}>Total Amount</Text>
            <Text style={styles.bottomTotalValue}>₹{total}</Text>
          </View>

          <TouchableOpacity
            style={[styles.payButton, placing && { opacity: 0.6 }]}
            onPress={handlePlaceOrder}
            disabled={placing}
          >
            {placing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.payButtonText}>
                {selectedPayment === 'cod' ? 'Place Order (COD)' : `Pay ₹${total}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  backCircle: {
    width: 38, height: 38, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#2C1F13' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  
  summaryCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: '#166534', letterSpacing: 0.5 },
  summaryName: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginTop: 2 },
  summaryAddress: { fontSize: 13, color: '#4b5563', marginTop: 2 },

  amountCard: {
    backgroundColor: '#f0fdf4', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#bbf7d0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  amountLabel: { fontSize: 15, fontWeight: '700', color: '#166534' },
  amountValue: { fontSize: 22, fontWeight: '900', color: '#166534' },

  sectionHeading: { fontSize: 13, fontWeight: '800', color: '#4b5563', letterSpacing: 0.6, marginTop: 4 },

  paymentCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  paymentCardActive: {
    borderColor: '#166534', backgroundColor: '#f9fdfa',
  },
  radioCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#166534',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#166534',
  },
  paymentOptionTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  paymentOptionSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  badgeRow: { flexDirection: 'row', marginTop: 6 },
  recommendedBadge: {
    fontSize: 10, fontWeight: '800', color: '#166534', backgroundColor: '#dcfce7',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },

  trustBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 10, paddingVertical: 10, marginTop: 8,
  },
  trustText: { fontSize: 13, fontWeight: '600', color: '#166534' },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb', elevation: 8,
  },
  totalBlock: { gap: 2 },
  bottomTotalLabel: { fontSize: 12, color: '#6b7280' },
  bottomTotalValue: { fontSize: 20, fontWeight: '800', color: '#1f2937' },

  payButton: {
    backgroundColor: '#166534', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', minWidth: 170,
  },
  payButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
