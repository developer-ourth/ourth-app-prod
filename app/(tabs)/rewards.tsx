import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Leaf, Gift, ChevronLeft, ShoppingBag, ChevronRight } from '@/components/icons';
import api, { orderAPI } from '@/lib/api';
import type { RewardTransaction, RewardCatalogItem, ApiResponse, Order } from '@/lib/types';

const BG_IMAGE = require('../../assets/Frame16.png');

interface RewardsData {
  points_balance: number;
  transactions: RewardTransaction[];
}

export default function RewardsScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'history' | 'redeem'>('history');

  const fetchData = useCallback(async () => {
    try {
      const [rewardsRes, catalogRes, ordersRes] = await Promise.all([
        api.get<ApiResponse<RewardsData>>('/me/rewards').catch(() => null),
        api.get<ApiResponse<RewardCatalogItem[]>>('/me/rewards/catalog').catch(() => null),
        orderAPI.listOrders().catch(() => null),
      ]);

      if (rewardsRes?.data?.data) {
        setBalance(rewardsRes.data.data.points_balance ?? 0);
        setTransactions(rewardsRes.data.data.transactions ?? []);
      }
      if (catalogRes?.data?.data) {
        setCatalog(catalogRes.data.data ?? []);
      }
      if (ordersRes?.data) {
        const orderList: Order[] = ordersRes.data.data ?? ordersRes.data ?? [];
        setOrders(orderList);
      }
    } catch {
      // silently handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData]),
  );

  async function handleRedeem(item: RewardCatalogItem) {
    if (balance < item.points_required) {
      Alert.alert('Insufficient Points', `You need ${item.points_required} points to redeem this.`);
      return;
    }
    Alert.alert('Redeem Reward', `Redeem "${item.name}" for ${item.points_required} pts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Redeem',
        onPress: async () => {
          try {
            await api.post('/me/rewards/redeem', { reward_catalog_id: item.id });
            Alert.alert('Success', `"${item.name}" redeemed successfully!`);
            fetchData();
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to redeem.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <ImageBackground source={BG_IMAGE} style={{ flex: 1 }} resizeMode="cover">
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={BG_IMAGE} style={styles.screen} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Rewards</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Rewards Balance</Text>
          <View style={styles.balanceRow}>
            <Leaf size={32} color="#4ade80" fill="#4ade80" />
            <Text style={styles.balanceAmount}>{balance.toLocaleString()}</Text>
            <Text style={styles.balancePts}>Leaves</Text>
          </View>
        </View>

        {/* Rewards History Title / Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rewards History</Text>
        </View>

        <FlatList
          data={
            orders.length > 0
              ? orders.flatMap((ord) => {
                  const itemsArr: Array<{
                    id: string;
                    orderId: number;
                    title: string;
                    subtitle: string;
                    date: string;
                    points: number;
                    isEarned: boolean;
                    isOrder: boolean;
                    badgeLabel: string;
                  }> = [];

                  const formattedDate = ord.created_at
                    ? new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';

                  // Check if leaves were used on this order
                  const usedPoints = ord.green_points_used ?? (ord.use_green_points ? 50 : 0);
                  if (usedPoints > 0) {
                    itemsArr.push({
                      id: `order-used-${ord.id}`,
                      orderId: ord.id,
                      title: `Order #${ord.order_number || ord.id}`,
                      subtitle: `Discount Applied • ${ord.order_status?.toUpperCase() || 'COMPLETED'}`,
                      date: formattedDate,
                      points: -Math.abs(usedPoints),
                      isEarned: false,
                      isOrder: true,
                      badgeLabel: 'USED ON ORDER',
                    });
                  }

                  // Leaves earned on this order
                  const earnedPoints = ord.green_points_earned ?? Math.max(1, Math.round(parseFloat(ord.total_amount) * 0.05));
                  itemsArr.push({
                    id: `order-earned-${ord.id}`,
                    orderId: ord.id,
                    title: `Order #${ord.order_number || ord.id}`,
                    subtitle: `Total Spent: ₹${ord.total_amount} • ${ord.order_status?.toUpperCase() || 'COMPLETED'}`,
                    date: formattedDate,
                    points: earnedPoints,
                    isEarned: true,
                    isOrder: true,
                    badgeLabel: 'EARNED ON ORDER',
                  });

                  return itemsArr;
                }).concat(
                  transactions.map((tx) => ({
                    id: `tx-${tx.id}`,
                    orderId: 0,
                    title: tx.description || tx.source || 'Green Points Reward',
                    subtitle: tx.source ? `Source: ${tx.source}` : 'Reward activity',
                    date: tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
                    points: tx.points,
                    isEarned: (tx.points ?? 0) >= 0,
                    isOrder: false,
                    badgeLabel: (tx.points ?? 0) >= 0 ? 'CREDIT' : 'REDEEMED',
                  }))
                )
              : transactions.map((tx) => ({
                  id: `tx-${tx.id}`,
                  orderId: 0,
                  title: tx.description || tx.source || 'Green Points Reward',
                  subtitle: tx.source ? `Source: ${tx.source}` : 'Reward activity',
                  date: tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
                  points: tx.points,
                  isEarned: (tx.points ?? 0) >= 0,
                  isOrder: false,
                  badgeLabel: (tx.points ?? 0) >= 0 ? 'CREDIT' : 'REDEEMED',
                }))
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={['#16a34a']} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.txCard}
              activeOpacity={item.isOrder ? 0.75 : 1}
              onPress={() => {
                if (item.isOrder && item.orderId) {
                  router.push({ pathname: '/order/[id]', params: { id: String(item.orderId) } });
                }
              }}
            >
              <View style={styles.txLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {item.isOrder && <ShoppingBag size={15} color="#166534" />}
                  <Text style={styles.txOrderId} numberOfLines={1}>{item.title}</Text>
                </View>
                <Text style={styles.txOrderSub}>{item.subtitle}</Text>
                {item.date ? <Text style={styles.txOrderLabel}>{item.date}</Text> : null}
              </View>

              <View style={styles.txRight}>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Leaf size={16} color={item.isEarned ? '#16a34a' : '#dc2626'} fill={item.isEarned ? '#16a34a' : 'none'} />
                    <Text style={[styles.txPoints, item.isEarned ? { color: '#16a34a' } : { color: '#dc2626' }]}>
                      {item.isEarned ? `+${item.points}` : `${item.points}`} leaves
                    </Text>
                  </View>
                  <Text style={[styles.earnedBadge, !item.isEarned && styles.usedBadge]}>
                    {item.badgeLabel}
                  </Text>
                </View>
                {item.isOrder && <ChevronRight size={16} color="#9ca3af" />}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Leaf size={48} color="#16a34a" />
              <Text style={styles.emptyTitle}>No transactions or order rewards yet</Text>
            </View>
          }
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen:               { flex: 1 },
  center:               { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  topBar:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  topBarTitle:          { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  backCircle:           { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },

  // Balance card
  balanceCard:          {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  balanceLabel:         { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  balanceRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceAmount:        { fontSize: 40, fontWeight: '700', color: '#1f2937' },
  balancePts:           { fontSize: 22, fontWeight: '600', color: '#1f2937', marginTop: 4 },

  sectionHeader:       { marginHorizontal: 16, marginBottom: 12 },
  sectionTitle:        { fontSize: 16, fontWeight: '700', color: '#1f2937' },

  // List
  listContent:          { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },

  // Transaction card
  txCard:               {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  txLeft:               { flex: 1, gap: 2 },
  txOrderLabel:         { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  txOrderSub:           { fontSize: 12, color: '#4b5563', fontWeight: '500' },
  txOrderId:            { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  txRight:              { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txPoints:             { fontSize: 14, fontWeight: '700', color: '#374151' },
  earnedBadge:          { fontSize: 9, fontWeight: '800', color: '#166534', backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  usedBadge:            { color: '#991b1b', backgroundColor: '#fee2e2' },

  // Empty
  empty:                { marginTop: 80, alignItems: 'center' },
  emptyTitle:           { marginTop: 12, fontSize: 16, fontWeight: '500', color: '#1A5C2E' },
});
