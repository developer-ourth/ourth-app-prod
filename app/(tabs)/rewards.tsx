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
import { Leaf, Gift, ChevronLeft } from '@/components/icons';
import api from '@/lib/api';
import type { RewardTransaction, RewardCatalogItem, ApiResponse } from '@/lib/types';

const BG_IMAGE = require('../../assets/Frame16.png');

interface RewardsData {
  points_balance: number;
  transactions: RewardTransaction[];
}

export default function RewardsScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'history' | 'redeem'>('history');

  const fetchData = useCallback(async () => {
    try {
      const [rewardsRes, catalogRes] = await Promise.all([
        api.get<ApiResponse<RewardsData>>('/me/rewards'),
        api.get<ApiResponse<RewardCatalogItem[]>>('/me/rewards/catalog'),
      ]);
      setBalance(rewardsRes.data.data.points_balance);
      setTransactions(rewardsRes.data.data.transactions);
      setCatalog(catalogRes.data.data);
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

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabPill, tab === 'history' && styles.tabPillActive]}
            onPress={() => setTab('history')}
          >
            <Text style={[styles.tabPillText, tab === 'history' && styles.tabPillTextActive]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, tab === 'redeem' && styles.tabPillActive]}
            onPress={() => setTab('redeem')}
          >
            <Text style={[styles.tabPillText, tab === 'redeem' && styles.tabPillTextActive]}>Redeem</Text>
          </TouchableOpacity>
        </View>

        {tab === 'history' ? (
          <FlatList
            data={transactions}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={['#16a34a']} />
            }
            renderItem={({ item }) => (
              <View style={styles.txCard}>
                <View style={styles.txLeft}>
                  <Text style={styles.txOrderLabel}>Order ID:</Text>
                  <Text style={styles.txOrderId} numberOfLines={1}>{item.source || item.description}</Text>
                </View>
                <View style={styles.txRight}>
                  <Leaf size={18} color="#9ca3af" />
                  <Text style={styles.txPoints}>{item.points} leaves</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Leaf size={48} color="#000000" />
                <Text style={styles.emptyTitle}>No transactions yet</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={catalog}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.rewardCard}>
                <View style={styles.rewardRow}>
                  <View style={styles.rewardInfo}>
                    <Text style={styles.rewardName}>{item.name}</Text>
                    <Text style={styles.rewardDesc}>{item.description}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.redeemBtn, balance >= item.points_required ? styles.redeemBtnActive : styles.redeemBtnDisabled]}
                    onPress={() => handleRedeem(item)}
                  >
                    <Leaf size={14} color={balance >= item.points_required ? '#fff' : '#9ca3af'} style={{ marginRight: 4 }} />
                    <Text style={[styles.redeemBtnText, balance >= item.points_required ? styles.redeemBtnTextActive : styles.redeemBtnTextDisabled]}>
                      {item.points_required} leaves
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Gift size={48} color="#d1d5db" />
                <Text style={styles.emptyTitle}>No rewards available</Text>
              </View>
            }
          />
        )}
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

  // Tabs
  tabContainer:         {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 4,
    gap: 4,
  },
  tabPill:              { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabPillActive:        { backgroundColor: '#86efac' },
  tabPillText:          { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  tabPillTextActive:    { color: '#14532d' },

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
  txLeft:               { flex: 1 },
  txOrderLabel:         { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  txOrderId:            { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  txRight:              { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txPoints:             { fontSize: 14, fontWeight: '700', color: '#374151' },

  // Redeem card
  rewardCard:           {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rewardRow:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rewardInfo:           { flex: 1 },
  rewardName:           { fontSize: 14, fontWeight: '600', color: '#111827' },
  rewardDesc:           { marginTop: 2, fontSize: 12, color: '#6b7280' },
  redeemBtn:            { marginLeft: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  redeemBtnActive:      { backgroundColor: '#16a34a' },
  redeemBtnDisabled:    { backgroundColor: '#e5e7eb' },
  redeemBtnText:        { fontSize: 12, fontWeight: '600' },
  redeemBtnTextActive:  { color: '#fff' },
  redeemBtnTextDisabled:{ color: '#9ca3af' },

  // Empty
  empty:                { marginTop: 80, alignItems: 'center' },
  emptyTitle:           { marginTop: 12, fontSize: 16, fontWeight: '500', color: '#1A5C2E' },
});
