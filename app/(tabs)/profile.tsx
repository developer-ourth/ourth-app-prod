import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { User, ChevronLeft, Pencil, LogOut } from '@/components/icons';
import { BlurView } from 'expo-blur';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { AuthUser, ApiResponse } from '@/lib/types';

const BG_IMAGE = require('../../assets/Frame16.png');

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, setUser } = useAuthStore();
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const { data } = await api.get<ApiResponse<AuthUser>>('/me/profile');
      setProfile(data.data);
      setName(data.data.name);
      setPhone(data.data.phone ?? '');
    } catch {
      // silently handled
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Validation', 'Name must be at least 2 characters long.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch<ApiResponse<AuthUser>>('/me/profile', { name: name.trim(), phone });
      setProfile(data.data);
      setUser(data.data);
      setEditing(false);
      Alert.alert('Success', 'Profile updated.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  const [deleting, setDeleting] = useState(false);

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch {
            // RootLayout will handle redirect
          }
        },
      },
    ]);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and your profile and order data will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete('/me/account');
              // Show confirmation alert first, logout inside OK press so
              // the alert is fully visible before navigation redirects.
              Alert.alert(
                'Account Deleted',
                'Your account has been permanently deleted.',
                [{ text: 'OK', onPress: () => logout() }],
                { cancelable: false }
              );
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete account.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ImageBackground source={BG_IMAGE} style={styles.screen} resizeMode="cover">
        <SafeAreaView style={styles.centerFill}>
          <ActivityIndicator size="large" color="#1a6b5a" />
        </SafeAreaView>
      </ImageBackground>
    );
  }

  const GROUP1 = [
    { label: 'Your Orders',       onPress: () => router.push('/(tabs)/orders') },
    { label: 'Address Book',      onPress: () => router.push('/settings/address') },
    { label: 'Your Collections',  onPress: () => router.push('/(tabs)/collections') },
    { label: 'Payment Methods',   onPress: () => router.push('/settings/payment-methods') },
    { label: 'Tax & GST Settings',onPress: () => router.push('/settings/tax-settings') },
    ...(profile?.role === 'vendor' ? [
      { label: 'Business KYC Verification', onPress: () => router.push('/settings/kyc') }
    ] : []),
    { label: 'Your Refunds',      onPress: () => {} },
  ];

  const GROUP2 = [
    { label: 'Help & Support',    onPress: () => router.push('/settings/support') },
    { label: 'Notifications',     onPress: () => router.push('/(tabs)/notifications') },
    { label: 'General info',      onPress: () => router.push('/settings/general') },
    { label: 'About us',          onPress: () => router.push('/settings/general') },
  ];

  return (
    <ImageBackground source={BG_IMAGE} style={styles.screen} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>
        {/* Back button */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 10 }} showsVerticalScrollIndicator={false}>

          {/* ── Profile card ── */}
          <View style={styles.profileCard}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            {/* Avatar */}
            <View style={styles.avatarCircle}>
              <User size={32} color="#9ca3af" />
            </View>

            {/* Info */}
            <View style={styles.cardInfo}>
              <View style={styles.cardNameRow}>
                {editing ? (
                  <TextInput
                    style={[styles.cardNameText, styles.nameInput]}
                    value={name}
                    onChangeText={setName}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.cardNameText} numberOfLines={1}>
                    {profile?.business_name ?? profile?.name ?? '—'}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => (editing ? handleSave() : setEditing(true))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#1a6b5a" />
                  ) : editing ? (
                    <Text style={styles.saveText}>Save</Text>
                  ) : (
                    <Pencil size={18} color="#1a6b5a" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.cardSubText} numberOfLines={1}>
                {profile?.name}
              </Text>
              {profile?.role === 'vendor' && (
                <Text style={styles.cardSubText} numberOfLines={1}>
                  {profile?.gstin ?? 'GST not set'}
                </Text>
              )}

              {editing && (
                <TouchableOpacity onPress={() => setEditing(false)} style={{ marginTop: 4 }}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Group 1 ── */}
          {GROUP1.map((item) => (
            <TouchableOpacity key={item.label} style={styles.menuItemBlue} onPress={item.onPress} activeOpacity={0.7}>
              <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
              <Text style={styles.menuItemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          {/* ── Group 2 ── */}
          {GROUP2.map((item) => (
            <TouchableOpacity key={item.label} style={styles.menuItemGreen} onPress={item.onPress} activeOpacity={0.7}>
              <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
              <Text style={styles.menuItemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          {/* ── Log out ── */}
          <TouchableOpacity style={styles.menuItemLogout} onPress={handleLogout} activeOpacity={0.7}>
            <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
            <LogOut size={16} color="#374151" style={{ marginRight: 6 }} />
            <Text style={styles.menuItemText}>Log out</Text>
          </TouchableOpacity>

          {/* ── Delete Account ── */}
          <TouchableOpacity style={styles.menuItemDelete} onPress={handleDeleteAccount} activeOpacity={0.7} disabled={deleting}>
            <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
            {deleting ? (
              <ActivityIndicator size="small" color="#dc2626" style={{ marginRight: 6 }} />
            ) : (
              <LogOut size={16} color="#dc2626" style={{ marginRight: 6 }} />
            )}
            <Text style={[styles.menuItemText, { color: '#dc2626', fontWeight: '700' }]}>
              {deleting ? 'Deleting Account...' : 'Delete Account'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1 },
  centerFill:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar:         { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  backCircle:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },

  /* Profile card */
  profileCard:    {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    marginBottom: 6,
  },
  avatarCircle:   { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  cardInfo:       { flex: 1 },
  cardNameRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  cardNameText:   { fontSize: 15, fontWeight: '700', color: '#1f2937', flex: 1 },
  nameInput:      { borderBottomWidth: 1, borderBottomColor: '#1a6b5a', paddingVertical: 0 },
  saveText:       { fontSize: 13, fontWeight: '700', color: '#1a6b5a' },
  cardSubText:    { fontSize: 13, color: '#6b7280', marginTop: 2 },
  cancelText:     { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  /* Menu items */
  menuItemBlue: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#6EC9D8',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemGreen: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#7DBF8A',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#c23c3c',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 226, 226, 0.4)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  menuItemText:   { fontSize: 15, color: '#1f2937' },
});

