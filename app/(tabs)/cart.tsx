import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import RazorpayCheckout from 'react-native-razorpay';
import { ShoppingCart, ChevronLeft, Minus, Plus, Heart, ArrowUp, MapPin, ChevronRight, Trash2 } from '@/components/icons';
import { fixAssetUrl, addressAPI, marketplaceAPI, orderAPI } from '@/lib/api';
import { useCartStore } from '@/lib/cartStore';
import { useAuthStore } from '@/lib/store';
import { isExpoGo } from '@/lib/pushNotifications';
import type { CartItem, Address, Product } from '@/lib/types';

const BG_IMAGE = require('../../assets/Frame16.png');
const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '';

function getPaymentErrorMessage(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }

  if (err && typeof err === 'object') {
    const maybeError = err as { message?: unknown; description?: unknown; code?: unknown };
    const message = typeof maybeError.message === 'string' && maybeError.message.trim()
      ? maybeError.message.trim()
      : typeof maybeError.description === 'string' && maybeError.description.trim()
        ? maybeError.description.trim()
        : '';

    if (message) {
      return message;
    }

    if (typeof maybeError.code === 'string' && maybeError.code.trim()) {
      return maybeError.code.trim();
    }
  }

  return 'Could not complete payment. Please try again.';
}

export default function CartScreen() {
  const router = useRouter();
  const { cart, loading, fetchCart, updateItem, removeItem, clearCart, addItem } = useCartStore();
  const { user } = useAuthStore();
  const isB2B = user?.role === 'vendor';

  const [placing, setPlacing] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<'cod' | 'upi'>('cod');
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await addressAPI.list();
      const list: Address[] = res.data?.data ?? res.data ?? [];
      setAddresses(list);

      setSelectedAddress((prev) => {
        if (prev) {
          const stillExists = list.find((a) => a.id === prev.id);
          if (stillExists) {
            return stillExists;
          }
        }

        return list.find((a) => a.is_default) ?? list[0] ?? null;
      });
    } catch {
      // Keep previous UI state if address fetch fails temporarily.
    }
  }, []);

  const PAYMENT_OPTIONS: { key: 'cod' | 'upi'; label: string; sub: string }[] = [
    { key: 'cod', label: 'Cash on Delivery', sub: 'Pay when your order arrives' },
    { key: 'upi',  label: 'UPI / Paytm',     sub: 'Secure online payment via Razorpay' },
  ];

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses]),
  );

  useEffect(() => {
    marketplaceAPI.getProducts({ per_page: 3, page: 1 }).then((res) => {
      setSuggestedProducts(res.data?.data ?? []);
    }).catch(() => {});
  }, []);

  const handleQuantityChange = useCallback(
    (item: CartItem, delta: number) => {
      const next = item.quantity + delta;
      if (isB2B && delta < 0) {
        const minQty = item.product?.min_order_quantity ?? 1;
        if (next < minQty) {
          Alert.alert('Minimum Order Quantity', `Minimum order quantity for "${item.product?.name ?? 'this item'}" is ${minQty} units.`);
          return;
        }
      }

      if (next < 1) {
        Alert.alert('Remove item', `Remove ${item.product?.name ?? 'this item'} from cart?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeItem(item.id) },
        ]);
      } else {
        updateItem(item.id, next);
      }
    },
    [updateItem, removeItem, isB2B],
  );

  const handleRemoveItem = useCallback(
    (item: CartItem) => {
      Alert.alert('Remove item', `Remove ${item.product?.name ?? 'this item'} from cart?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(item.id) },
      ]);
    },
    [removeItem],
  );

  const handleCheckout = useCallback(async () => {
    if (!selectedAddress) {
      Alert.alert('No Address', 'Please select a delivery address before placing the order.');
      return;
    }

    const isCod = selectedPayment === 'cod';
    const paymentLabel = isCod ? 'Cash on Delivery' : 'UPI / Paytm';
    const isRazorpayModuleReady = typeof (RazorpayCheckout as { open?: unknown })?.open === 'function';

    if (!isCod && (isExpoGo || !isRazorpayModuleReady)) {
      Alert.alert(
        'UPI Not Available',
        'UPI/Paytm requires a development or production build with Razorpay native module. Please install a dev build and try again.',
      );
      return;
    }

    Alert.alert(
      'Confirm Order',
      `Place order for ₹${cart?.total_amount ?? '0'} (${paymentLabel}) to ${selectedAddress.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Place Order',
          onPress: async () => {
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
                    theme: { color: '#1a6b5a' },
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
              Alert.alert('Success', isCod ? 'Order placed successfully.' : 'Payment successful and order placed.');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Could not place order. Please try again.';

              if (!isCod && createdOrderId) {
                if (msg === 'Payment cancelled by user.') {
                  Alert.alert('Payment Cancelled', 'You closed the Razorpay checkout before completing payment.', [
                    { text: 'OK', onPress: () => router.replace('/(tabs)/orders') },
                  ]);
                  return;
                }

                Alert.alert(
                  'Payment Failed',
                  msg,
                  [
                    { text: 'OK', onPress: () => router.replace('/(tabs)/orders') },
                  ],
                );
              } else {
                Alert.alert('Order Failed', msg);
              }
            } finally {
              setPlacing(false);
            }
          },
        },
      ],
    );
  }, [selectedAddress, selectedPayment, cart, clearCart, router]);

  if (loading && !cart) {
    return (
      <ImageBackground source={BG_IMAGE} style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color="#1a6b5a" />
      </ImageBackground>
    );
  }

  const items = cart?.items ?? [];
  const total = cart?.total_amount ?? '0';
  const subtotal = items.reduce((sum, item) => {
    const price = parseFloat(
      item.unit_price ?? item.product?.discounted_price ?? item.product?.base_price ?? '0',
    );
    return sum + price * item.quantity;
  }, 0);

  return (
    <ImageBackground source={BG_IMAGE} style={styles.screen} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 38 }} />
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <ShoppingCart size={64} color="#9ca3af" />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>Add items from the shop to get started</Text>
            <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.shopBtnText}>Browse Shop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Cart items box */}
              <View style={styles.itemsBox}>
                <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(60,125,200,0.38)', 'rgba(138,239,242,0.38)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
                  pointerEvents="none"
                />
                {items.map((item, idx) => {
                  const uri = item.product?.primary_image_url
                    ? fixAssetUrl(item.product.primary_image_url)
                    : undefined;
                  const unitPrice = item.unit_price ?? (
                    isB2B && item.product?.wholesale_price !== null && item.product?.wholesale_price !== undefined
                      ? item.product.wholesale_price
                      : (item.product?.discounted_price ?? item.product?.base_price)
                  );

                  return (
                    <View key={String(item.id)}>
                      <View style={styles.itemRow}>
                        <View style={styles.itemImageBox}>
                          {uri ? (
                            <Image source={{ uri }} style={styles.itemImage} resizeMode="contain" />
                          ) : (
                            <Text style={styles.itemImagePlaceholder}>🌿</Text>
                          )}
                        </View>

                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName} numberOfLines={2}>
                            {item.product?.name ?? `Product #${item.product_id}`}
                            {item.productPack ? ` (${item.productPack.name})` : ''}
                          </Text>
                          <Text style={styles.itemUnits}>{item.quantity} units</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                            <TouchableOpacity onPress={() => router.push('/(tabs)/collections')}>
                              <Text style={styles.addToCollection}>Add to your collection</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleRemoveItem(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Trash2 size={12} color="#dc2626" fill="none" />
                              <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '500' }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={styles.itemRight}>
                          <View style={styles.qtyControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => handleQuantityChange(item, -1)}>
                              <Minus size={12} color="#374151" />
                            </TouchableOpacity>
                            <Text style={styles.qtyNum}>{item.quantity}</Text>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => handleQuantityChange(item, +1)}>
                              <Plus size={12} color="#374151" />
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.itemPrice}>₹{unitPrice}</Text>
                        </View>
                      </View>
                      {idx < items.length - 1 && <View style={styles.divider} />}
                    </View>
                  );
                })}
              </View>

              {/* You might also like */}
              <View style={styles.suggestBox}>
                <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['#C8963C', '#F2D48A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
                  pointerEvents="none"
                />
                <Text style={styles.suggestTitle}>You might also like</Text>
                <View style={styles.suggestRow}>
                  {suggestedProducts.map((prod) => {
                    const price = isB2B && prod.wholesale_price !== null && prod.wholesale_price !== undefined
                      ? parseFloat(prod.wholesale_price)
                      : (prod.discounted_price
                        ? parseFloat(prod.discounted_price)
                        : parseFloat(prod.base_price));
                    const uri = prod.primary_image_url
                      ? fixAssetUrl(prod.primary_image_url)
                      : null;
                    return (
                      <TouchableOpacity
                        key={String(prod.id)}
                        style={styles.suggestCard}
                        activeOpacity={0.85}
                        onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(prod.id) } })}
                      >
                        <View style={styles.glassBase}>
                          <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
                        </View>
                        <View style={styles.suggestTop}>
                          {uri ? (
                            <Image source={{ uri }} style={styles.suggestImage} resizeMode="contain" />
                          ) : (
                            <View style={styles.suggestImagePlaceholder}>
                              <Text style={{ fontSize: 24 }}>🌿</Text>
                            </View>
                          )}
                          <Text style={styles.suggestName} numberOfLines={1}>{prod.name}</Text>
                          <Text style={styles.suggestPrice}>
                            ₹{Math.round(price)}
                            {isB2B && prod.wholesale_price !== null && (
                              <Text style={{ fontSize: 8, color: '#1a6b5a', fontWeight: 'bold' }}> B2B</Text>
                            )}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.suggestAddBtn}
                          activeOpacity={0.8}
                          onPress={async () => {
                            try {
                              await addItem(prod.id);
                            } catch (err: unknown) {
                              Alert.alert('Error', err instanceof Error ? err.message : 'Could not add item.');
                            }
                          }}
                        >
                          <Text style={styles.suggestAddBtnText}>ADD</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>


              {/* Billing Details */}
              <View style={styles.billingBox}>
                <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['#FAF8F3', '#EDE8DC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { opacity: 0.2 }]}
                  pointerEvents="none"
                />
                <Text style={styles.billingTitle}>Billing Details</Text>
                <View style={styles.billingRow}>
                  <Text style={styles.billingLabel}>Sub Total</Text>
                  <Text style={styles.billingValue}>₹{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.billingRow}>
                  <Text style={styles.billingLabel}>Delivery Charges</Text>
                  <Text style={[styles.billingValue, styles.freeText]}>Free</Text>
                </View>
                <View style={styles.billingRow}>
                  <Text style={styles.billingLabel}>Discount</Text>
                  <Text style={[styles.billingValue, styles.discountText]}>— ₹0.00</Text>
                </View>
                <View style={styles.billingDivider} />
                <View style={styles.billingRow}>
                  <Text style={styles.billingTotalLabel}>Total Amount</Text>
                  <Text style={styles.billingTotalValue}>₹{total}</Text>
                </View>
              </View>

            </ScrollView>

            {/* Address Picker Modal */}
            <Modal
              visible={showAddressPicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowAddressPicker(false)}
            >
              <Pressable style={styles.modalOverlay} onPress={() => setShowAddressPicker(false)}>
                <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>Select Delivery Address</Text>
                    <TouchableOpacity onPress={() => setShowAddressPicker(false)}>
                      <Text style={styles.pickerClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  {addresses.length === 0 ? (
                    <View style={styles.pickerEmpty}>
                      <MapPin size={32} color="#9ca3af" />
                      <Text style={styles.pickerEmptyText}>No saved addresses</Text>
                      <TouchableOpacity
                        style={styles.addAddressBtn}
                        onPress={() => { setShowAddressPicker(false); router.push('/settings/address'); }}
                      >
                        <Text style={styles.addAddressBtnText}>Add Address</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <FlatList
                      data={addresses}
                      keyExtractor={(a) => String(a.id)}
                      contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
                      renderItem={({ item: addr }) => {
                        const isActive = selectedAddress?.id === addr.id;
                        return (
                          <TouchableOpacity
                            style={[styles.pickerItem, isActive && styles.pickerItemActive]}
                            onPress={() => { setSelectedAddress(addr); setShowAddressPicker(false); }}
                          >
                            <View style={{ flex: 1, gap: 3 }}>
                              <Text style={styles.pickerItemName}>{addr.name}</Text>
                              <Text style={styles.pickerItemAddr} numberOfLines={2}>
                                {[addr.address_line1, addr.address_line2, addr.city, addr.state, addr.postal_code]
                                  .filter(Boolean).join(', ')}
                              </Text>
                              {addr.is_default && (
                                <Text style={styles.defaultBadge}>Default</Text>
                              )}
                            </View>
                            {isActive && <ChevronRight size={16} color="#1a6b5a" />}
                          </TouchableOpacity>
                        );
                      }}
                    />
                  )}
                  <TouchableOpacity
                    style={styles.manageAddressBtn}
                    onPress={() => { setShowAddressPicker(false); router.push('/settings/address'); }}
                  >
                    <MapPin size={14} color="#3C7DC8" />
                    <Text style={styles.manageAddressBtnText}>Manage Addresses</Text>
                  </TouchableOpacity>
                </Pressable>
              </Pressable>
            </Modal>

            {/* Delivery + Bottom bar — pinned together */}
            <View style={styles.bottomBlock}>
              {/* Delivery info */}
              <View style={styles.deliveryRow}>
                {selectedAddress ? (
                  <View style={styles.deliveryLeft}>
                    <Text style={styles.deliveryTitle}>Delivering to {selectedAddress.name}</Text>
                    <Text style={styles.deliveryAddress} numberOfLines={2}>
                      {[selectedAddress.address_line1, selectedAddress.address_line2, selectedAddress.city, selectedAddress.state]
                        .filter(Boolean).join(', ')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.deliveryLeft}>
                    <Text style={styles.deliveryTitle}>No address selected</Text>
                    <Text style={styles.deliveryAddress}>Tap Change to add a delivery address</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => setShowAddressPicker(true)}>
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              </View>

              {/* Bottom bar */}
              <View style={styles.bottomBar}>
                <TouchableOpacity style={styles.paymentLeft} onPress={() => setShowPaymentPicker(true)}>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Pay Using </Text>
                    <ArrowUp size={14} color="#374151" />
                  </View>
                  <Text style={styles.payMethod}>
                    {selectedPayment === 'cod' ? 'Cash on Delivery' : 'UPI / Paytm'}
                  </Text>
                </TouchableOpacity>

                {/* Payment picker modal */}
                <Modal
                  visible={showPaymentPicker}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowPaymentPicker(false)}
                >
                  <Pressable style={styles.modalOverlay} onPress={() => setShowPaymentPicker(false)}>
                    <Pressable style={styles.pickerSheet}>
                      <Text style={styles.pickerTitle}>Select Payment Method</Text>
                      {PAYMENT_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.pickerItem, selectedPayment === opt.key && styles.pickerItemActive]}
                          onPress={() => { setSelectedPayment(opt.key); setShowPaymentPicker(false); }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pickerItemName}>{opt.label}</Text>
                            <Text style={styles.pickerItemAddr}>{opt.sub}</Text>
                          </View>
                          {selectedPayment === opt.key && <ChevronRight size={16} color="#1a6b5a" />}
                        </TouchableOpacity>
                      ))}
                    </Pressable>
                  </Pressable>
                </Modal>
                <TouchableOpacity
                  style={[styles.placeOrderBtn, placing && { opacity: 0.6 }]}
                  onPress={handleCheckout}
                  disabled={placing}
                >
                  {placing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.placeOrderText}>₹{total}  Place Order</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  backCircle: {
    width: 38, height: 38, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#2C1F13' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: '#2C1F13' },
  emptySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  shopBtn: { marginTop: 8, backgroundColor: '#1a6b5a', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  shopBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  itemsBox: {
    borderRadius: 15, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#1A255C',
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  itemImageBox: {
    width: 68, height: 68, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  itemImage:            { width: '100%', height: '100%' },
  itemImagePlaceholder: { fontSize: 30 },
  itemInfo:             { flex: 1, gap: 3 },
  itemName:             { fontSize: 14, fontWeight: '700', color: '#1e3a5f' },
  itemUnits:            { fontSize: 12, color: '#374151' },
  addToCollection:      { fontSize: 11, color: '#3C7DC8', marginTop: 2 },
  itemRight:            { alignItems: 'flex-end', gap: 8 },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, gap: 12,
  },
  qtyBtn: { padding: 2 },
  qtyNum: { fontSize: 13, fontWeight: '700', color: '#1e3a5f', minWidth: 16, textAlign: 'center' },
  itemPrice: { fontSize: 13, fontWeight: '700', color: '#1e3a5f' },
  divider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.5)' },
  suggestBox: {
    borderRadius: 15, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#2C1F13',
    backgroundColor: 'rgba(255,255,255,0.08)', padding: 14, gap: 10,
  },
  suggestTitle:  { fontSize: 15, fontWeight: '700', color: '#2C1F13' },
  suggestRow: { flexDirection: 'row', gap: 8 },
  suggestCard: {
    flex: 1, height: 160,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    elevation: 4,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 8,
  },
  glassBase: { ...StyleSheet.absoluteFillObject, borderRadius: 20, overflow: 'hidden' },
  suggestTop: {
    marginTop: 6, marginHorizontal: 6,
    height: 145,
    backgroundColor: '#EBF2E4',
    borderRadius: 16, overflow: 'hidden',
  },
  suggestHeartBtn:         { position: 'absolute', top: 6, left: 6, zIndex: 1, borderRadius: 20, padding: 4 },
  suggestImage:            { width: '100%', height: 90, marginTop: 8, backgroundColor: '#EBF2E4' },
  suggestImagePlaceholder: { width: '100%', height: 90, backgroundColor: '#EBF2E4', alignItems: 'center', justifyContent: 'center' },
  suggestName:   { fontSize: 12, fontWeight: '500', color: '#2C1F13', textAlign: 'center', paddingHorizontal: 6, paddingTop: 4 },
  suggestPrice:  { color: '#0D3A27', fontSize: 13, fontWeight: '600', margin: 8 },
  suggestAddBtn: { position: 'absolute', bottom: -1, right: -1, backgroundColor: '#F2D48A', borderTopLeftRadius: 12, borderBottomRightRadius: 18, paddingHorizontal: 12, paddingVertical: 7, elevation: 3 },
  suggestAddBtnText: { color: '#0D3A27', fontWeight: '700', fontSize: 12 },
  billingBox: {
    borderRadius: 15, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#1A255C',
    backgroundColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 10,
  },
  billingTitle: { fontSize: 15, fontWeight: '700', color: '#1e3a5f', marginBottom: 2 },
  billingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billingLabel: { fontSize: 13, color: '#6b7280' },
  billingValue: { fontSize: 13, fontWeight: '600', color: '#374151' },
  freeText: { color: '#1a6b5a', fontWeight: '700' },
  discountText: { color: '#c0392b' },
  billingDivider: { height: 1, backgroundColor: 'rgba(26,37,92,0.2)', marginVertical: 2 },
  billingTotalLabel: { fontSize: 14, fontWeight: '700', color: '#1e3a5f' },
  billingTotalValue: { fontSize: 15, fontWeight: '700', color: '#1e3a5f' },
  deliveryRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    backgroundColor: '#EBF2E4',
    padding: 14, gap: 8,
  },
  deliveryLeft:    { flex: 1, gap: 3 },
  deliveryTitle:   { fontSize: 13, fontWeight: '700', color: '#2C1F13' },
  deliveryAddress: { fontSize: 11, color: '#6b7280', lineHeight: 16 },
  changeText:      { fontSize: 13, fontWeight: '600', color: '#1a6b5a' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  pickerTitle:    { fontSize: 16, fontWeight: '700', color: '#1e3a5f' },
  pickerClose:    { fontSize: 18, color: '#6b7280', paddingHorizontal: 4 },
  pickerEmpty:    { alignItems: 'center', gap: 10, paddingVertical: 24 },
  pickerEmptyText:{ fontSize: 14, color: '#9ca3af' },
  addAddressBtn: {
    marginTop: 4, backgroundColor: '#1a6b5a', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  addAddressBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 12, backgroundColor: '#f9fafb',
  },
  pickerItemActive: { borderColor: '#1a6b5a', backgroundColor: '#f0fdf4' },
  pickerItemName:   { fontSize: 13, fontWeight: '700', color: '#1e3a5f' },
  pickerItemAddr:   { fontSize: 12, color: '#6b7280', lineHeight: 16 },
  defaultBadge: {
    alignSelf: 'flex-start', fontSize: 10, fontWeight: '700',
    color: '#1a6b5a', backgroundColor: '#dcfce7',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2,
  },
  manageAddressBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 14, paddingVertical: 10,
    borderTopWidth: 1, borderColor: '#e5e7eb',
  },
  manageAddressBtnText: { fontSize: 13, fontWeight: '600', color: '#3C7DC8' },
  bottomBlock: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EBF2E4', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  paymentLeft: { gap: 2 },
  payRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payLabel:    { fontSize: 12, color: '#4A3728' },
  payMethod:   { fontSize: 13, fontWeight: '600', color: '#4A3728' },
  placeOrderBtn: { backgroundColor: '#4A9B5F', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 14 },
  placeOrderText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
