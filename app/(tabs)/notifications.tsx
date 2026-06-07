import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Bell, BellOff, ChevronLeft } from '@/components/icons';
import api from '@/lib/api';
import type { Notification, PaginatedResponse } from '@/lib/types';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get<PaginatedResponse<Notification>>('/me/notifications');
      setNotifications(data.data);
      setUnreadCount((data.meta as { unread_count?: number })?.unread_count ?? 0);
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
      fetchNotifications();
    }, [fetchNotifications]),
  );

  async function markAllRead() {
    try {
      await api.post('/me/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silently handled
    }
  }

  async function markRead(id: number) {
    try {
      await api.patch(`/me/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {
      // silently handled
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
          <ChevronLeft size={20} color="#374151" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchNotifications(); }}
            colors={['#16a34a']}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.is_read && styles.cardUnread]}
            onPress={() => !item.is_read && markRead(item.id)}
          >
            <View style={styles.row}>
              <View style={[styles.iconWrap, item.is_read ? styles.iconWrapRead : styles.iconWrapUnread]}>
                <Bell size={16} color={item.is_read ? '#9ca3af' : '#16a34a'} />
              </View>
              <View style={styles.body}>
                <Text style={[styles.itemTitle, !item.is_read && styles.itemTitleUnread]}>
                  {item.title}
                </Text>
                <Text style={styles.itemMessage}>{item.message}</Text>
                <Text style={styles.itemDate}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
              {!item.is_read && <View style={styles.dot} />}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <BellOff size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySub}>No notifications right now</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: '#f9fafb' },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  backCircle:      { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  header:          {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle:     { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSub:       { marginTop: 2, fontSize: 14, color: '#6b7280' },
  markAllText:     { fontSize: 14, fontWeight: '600', color: '#16a34a' },
  listContent:     { padding: 16, gap: 8 },
  card:            {
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardUnread:      { backgroundColor: '#f0fdf4' },
  row:             { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap:        { marginTop: 2, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  iconWrapRead:    { backgroundColor: '#f3f4f6' },
  iconWrapUnread:  { backgroundColor: '#dcfce7' },
  body:            { flex: 1 },
  itemTitle:       { fontSize: 14, fontWeight: '500', color: '#374151' },
  itemTitleUnread: { color: '#111827' },
  itemMessage:     { marginTop: 2, fontSize: 12, color: '#6b7280' },
  itemDate:        { marginTop: 4, fontSize: 12, color: '#9ca3af' },
  dot:             { marginTop: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  empty:           { marginTop: 80, alignItems: 'center' },
  emptyTitle:      { marginTop: 12, fontSize: 16, fontWeight: '500', color: '#374151' },
  emptySub:        { marginTop: 4, fontSize: 14, color: '#9ca3af' },
});
