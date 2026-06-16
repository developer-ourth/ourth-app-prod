import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Package, ChevronLeft } from '@/components/icons';
import api, { fixAssetUrl } from '@/lib/api';
import type { Order, PaginatedResponse } from '@/lib/types';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const BG_IMAGE = require('../../assets/Frame16.png');

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'processing', 'out_for_delivery']);

function ordinalDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const mod100 = day % 100;
  const mod10  = day % 10;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th'
    : mod10 === 1 ? 'st'
    : mod10 === 2 ? 'nd'
    : mod10 === 3 ? 'rd'
    : 'th';
  const month = d.toLocaleString('en', { month: 'short' });
  return `${day}${suffix} ${month}, ${d.getFullYear()}`;
}

type Tab = 'orders' | 'cancelled';

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState<Tab>('orders');

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await api.get<PaginatedResponse<Order>>('/me/orders');
      setOrders(data.data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchOrders();
    }, [fetchOrders]),
  );

  const displayed = orders.filter((o) =>
    activeTab === 'cancelled'
      ? o.order_status === 'cancelled'
      : o.order_status !== 'cancelled',
  );

  if (loading) {
    return (
      <ImageBackground source={BG_IMAGE} style={{ flex: 1 }} resizeMode="cover">
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color="#1a6b5a" />
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Your Orders</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'orders' && styles.tabActiveOrders]}
            onPress={() => setActiveTab('orders')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActiveOrders]}>
              Orders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'cancelled' && styles.tabActiveCancelled]}
            onPress={() => setActiveTab('cancelled')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'cancelled' && styles.tabTextActiveCancelled]}>
              Cancelled
            </Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <FlatList
          data={displayed}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(); }}
              colors={['#1a6b5a']}
            />
          }
          renderItem={({ item }) => {
            const isActive    = ACTIVE_STATUSES.has(item.order_status);
            const isCompleted = item.order_status === 'delivered';
            const isCancelled = item.order_status === 'cancelled';
            const imgUrl      = item.items?.[0]?.product?.primary_image_url;
            const count       = item.items_count ?? item.items?.length ?? 0;

            const borderColor = isActive ? '#1A255C' : isCompleted ? '#2C1F13' : isCancelled ? '#14532d' : 'rgba(255,255,255,0.75)';

            return (
              <View style={[styles.card, { borderColor }]}>
                {!isActive && <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />}
                {isActive && (
                  <LinearGradient
                    colors={['#3C7DC8', '#8AEFF2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
                    pointerEvents="none"
                  />
                )}
                {isCompleted && (
                  <LinearGradient
                    colors={['#C8963C', '#F2D48A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
                    pointerEvents="none"
                  />
                )}
                {isCancelled && (
                  <LinearGradient
                    colors={['#14532d', '#86efac']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
                    pointerEvents="none"
                  />
                )}
                {/* Product image */}
                <View style={styles.imageBox}>
                  {imgUrl ? (
                    <Image
                      source={{ uri: fixAssetUrl(imgUrl) }}
                      style={styles.productImg}
                      resizeMode="contain"
                    />
                  ) : (
                    <Package size={36} color="#9ca3af" />
                  )}
                </View>

                {/* Order details */}
                <View style={[styles.cardContent, isActive && { overflow: 'hidden', borderRadius: 8 }]}>
                  {isActive && (
                    <LinearGradient
                      colors={['#3C7DC8', '#8AEFF2']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      pointerEvents="none"
                    />
                  )}
                  <Text style={styles.orderIdLabel}>Order ID:</Text>
                  <Text style={styles.orderIdValue} numberOfLines={1}>
                    {item.order_number || String(item.id)}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{ordinalDate(item.created_at)}</Text>
                    <Text style={styles.metaText}>{count}: items</Text>
                  </View>

                  {/* Action buttons */}
                  <View style={styles.btnRow}>
                    {isActive ? (
                      <>
                        <TouchableOpacity
                          style={styles.btnBlue}
                          onPress={() => router.push(`/order/${item.id}`)}
                          activeOpacity={0.75}
                        >
                          <LinearGradient
                            colors={['#3C7DC8', '#8AEFF2']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
                            pointerEvents="none"
                          />
                          <Text style={styles.btnBlueText}>Track Order</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnBlue}
                          onPress={() => Alert.alert('Order Again', 'This will add the same items to your cart.')}
                          activeOpacity={0.75}
                        >
                          <LinearGradient
                            colors={['#3C7DC8', '#8AEFF2']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
                            pointerEvents="none"
                          />
                          <Text style={styles.btnBlueText}>Order Again</Text>
                        </TouchableOpacity>
                      </>
                    ) : isCancelled ? (
                      <>
                        <TouchableOpacity
                          style={styles.btnGreen}
                          onPress={() => router.push(`/order/${item.id}`)}
                          activeOpacity={0.75}
                        >
                          <LinearGradient
                            colors={['#14532d', '#86efac']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
                            pointerEvents="none"
                          />
                          <Text style={styles.btnGreenText}>Order Details</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnGreen}
                          onPress={() => Alert.alert('Order Again', 'This will add the same items to your cart.')}
                          activeOpacity={0.75}
                        >
                          <LinearGradient
                            colors={['#14532d', '#86efac']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
                            pointerEvents="none"
                          />
                          <Text style={styles.btnGreenText}>Order Again</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.btnNeutral}
                          onPress={() => router.push(`/order/${item.id}`)}
                          activeOpacity={0.75}
                        >
                          <LinearGradient
                            colors={['#C8963C', '#F2D48A']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
                            pointerEvents="none"
                          />
                          <Text style={styles.btnNeutralText}>Order Details</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnNeutral}
                          onPress={() => Alert.alert('Order Again', 'This will add the same items to your cart.')}
                          activeOpacity={0.75}
                        >
                          <LinearGradient
                            colors={['#C8963C', '#F2D48A']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
                            pointerEvents="none"
                          />
                          <Text style={styles.btnNeutralText}>Order Again</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Package size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySub}>
                {activeTab === 'cancelled' ? 'No cancelled orders' : 'Start shopping to see orders here'}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  topBarTitle:  { fontSize: 22, fontWeight: '700', color: '#1f2937' },
  backCircle:   { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },

  tabRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 14 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(200,200,200,0.7)',
  },
  tabActiveOrders:    { backgroundColor: 'rgba(219,234,254,0.85)', borderColor: '#3b82f6' },
  tabActiveCancelled: { backgroundColor: 'rgba(254,226,226,0.85)', borderColor: '#ef4444' },
  tabText:             { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  tabTextActiveOrders:    { color: '#1d4ed8' },
  tabTextActiveCancelled: { color: '#dc2626' },

  listContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 14 },

  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 15,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)', // overridden inline per card
    gap: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,

  },
  imageBox: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImg: { width: 76, height: 76 },

  cardContent:  { flex: 1, justifyContent: 'space-between' },
  orderIdLabel: { fontSize: 13, color: '#2C1F13', fontFamily: 'IBM Plex Sans' },
  orderIdValue: { fontSize: 14, fontWeight: '700', color: '#4A3728', marginBottom: 4 },
  metaRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaText:     { fontSize: 12, color: '#4A3728' },

  btnRow: { flexDirection: 'row', gap: 8 },

  btnBlue: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1A255C',
    backgroundColor: 'rgba(110,201,216,0.12)',
    overflow: 'hidden',
  },
  btnBlueText: { fontSize: 12, fontWeight: '600', color: '#4A3728' },

  btnNeutral: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2C1F13',
    backgroundColor: 'rgba(196,169,107,0.12)',
    overflow: 'hidden',
  },
  btnNeutralText: { fontSize: 12, fontWeight: '600', color: '#4A3728' },

  btnGreen: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#14532d',
    backgroundColor: 'rgba(20,83,45,0.08)',
    overflow: 'hidden',
  },
  btnGreenText: { fontSize: 12, fontWeight: '600', color: '#14532d' },

  empty:     { marginTop: 80, alignItems: 'center' },
  emptyTitle:{ marginTop: 12, fontSize: 16, fontWeight: '500', color: '#374151' },
  emptySub:  { marginTop: 4, fontSize: 14, color: '#6b7280' },

  // Cancel modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  modalSub:     { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  modalLabel:   { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 20,
  },
  modalBtnRow:        { flexDirection: 'row', gap: 12 },
  modalBtnCancel:     { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#d1d5db', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalBtnConfirm:    { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#dc2626', alignItems: 'center' },
  modalBtnConfirmText:{ fontSize: 14, fontWeight: '600', color: '#fff' },
});
