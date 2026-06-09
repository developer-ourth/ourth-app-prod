import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  StyleSheet,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, MapPin } from '@/components/icons';
import { addressAPI, taxProfileAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { Address, UserTaxProfile } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BG_IMAGE = require('../../assets/Frame16.png');

export default function TaxSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // ── Tax profile ──────────────────────────────────────────────────────────
  const [profile, setProfile]           = useState<UserTaxProfile | null>(null);
  const [isGst, setIsGst]               = useState(false);
  const [gstin, setGstin]               = useState('');
  const [legalName, setLegalName]       = useState('');
  const [taxLoading, setTaxLoading]     = useState(true);
  const [taxSaving, setTaxSaving]       = useState(false);

  // ── Billing address ──────────────────────────────────────────────────────
  const [addresses, setAddresses]       = useState<Address[]>([]);
  const [addrLoading, setAddrLoading]   = useState(true);
  const [billingId, setBillingId]       = useState<number | null>(null);
  const [addrSaving, setAddrSaving]     = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [taxRes, addrRes, profileRes] = await Promise.all([
        taxProfileAPI.get(),
        addressAPI.list(),
        import('@/lib/api').then(({ default: api }) => api.get('/me/profile')),
      ]);
      const p: UserTaxProfile | null = taxRes.data?.data ?? null;
      if (p) {
        setProfile(p);
        setIsGst(p.is_gst_registered);
        setGstin(p.gstin ?? '');
        setLegalName(p.legal_business_name ?? '');
      } else {
        // No saved tax profile yet — pre-fill GSTIN from vendor registration
        const profileData = (profileRes?.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
        const registrationGstin = (profileData?.gstin ?? (user as Record<string, unknown>)?.gstin) as string | undefined;
        if (registrationGstin) {
          setIsGst(true);
          setGstin(registrationGstin);
        }
      }
      const list: Address[] = addrRes.data?.data ?? addrRes.data ?? [];
      setAddresses(list);
      const billing = list.find((a) => a.is_billing);
      setBillingId(billing?.id ?? null);
    } catch {
      Alert.alert('Error', 'Could not load settings.');
    } finally {
      setTaxLoading(false);
      setAddrLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveTaxProfile = async () => {
    if (isGst && gstin.trim().length !== 15) {
      Alert.alert('Validation', 'Please enter a valid 15-character GSTIN.');
      return;
    }
    setTaxSaving(true);
    try {
      await taxProfileAPI.upsert({
        is_gst_registered: isGst,
        gstin:              isGst ? gstin.trim().toUpperCase() : undefined,
        legal_business_name: legalName.trim() || undefined,
      });
      Alert.alert('Saved', 'Tax / GST settings updated.');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setTaxSaving(false);
    }
  };

  const setBillingAddress = async (id: number) => {
    if (id === billingId) { return; }
    setAddrSaving(true);
    try {
      // Clear existing billing first
      if (billingId) {
        await addressAPI.update(billingId, { is_billing: false } as never);
      }
      await addressAPI.update(id, { is_billing: true } as never);
      setBillingId(id);
      setAddresses(prev => prev.map(a => ({ ...a, is_billing: a.id === id })));
    } catch {
      Alert.alert('Error', 'Could not update billing address.');
    } finally {
      setAddrSaving(false);
    }
  };

  const isLoading = taxLoading || addrLoading;

  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tax & Billing</Text>
          <View style={{ width: 38 }} />
        </View>

        {isLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#1a6b5a" /></View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

              {/* ── GST / Tax Section ───────────────────────────────────── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>GST / Tax Settings</Text>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Registered for GST</Text>
                    <Text style={styles.switchSub}>Enable to include GSTIN on invoices</Text>
                  </View>
                  <Switch
                    value={isGst}
                    onValueChange={setIsGst}
                    trackColor={{ false: '#d1d5db', true: '#6ee7b7' }}
                    thumbColor={isGst ? '#1a6b5a' : '#9ca3af'}
                  />
                </View>

                {isGst && (
                  <>
                    <Text style={styles.fieldLabel}>GSTIN</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="22AAAAA0000A1Z5"
                      value={gstin}
                      onChangeText={(v) => setGstin(v.toUpperCase())}
                      autoCapitalize="characters"
                      maxLength={15}
                    />

                    <Text style={styles.fieldLabel}>Legal Business Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your registered business name"
                      value={legalName}
                      onChangeText={setLegalName}
                    />
                  </>
                )}

                <TouchableOpacity style={styles.saveBtn} onPress={saveTaxProfile} disabled={taxSaving}>
                  {taxSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveBtnText}>Save Tax Settings</Text>}
                </TouchableOpacity>
              </View>

              {/* ── Billing Address Section ─────────────────────────────── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Billing Address</Text>
                <Text style={styles.sectionSub}>This address appears on your tax invoices</Text>

                {addresses.length === 0 ? (
                  <TouchableOpacity
                    style={styles.emptyAddrBtn}
                    onPress={() => router.push('/settings/address')}
                  >
                    <MapPin size={16} color="#3C7DC8" />
                    <Text style={styles.emptyAddrText}>Add an address first</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {addrSaving && (
                      <ActivityIndicator size="small" color="#1a6b5a" style={{ marginBottom: 8 }} />
                    )}
                    {addresses.map((addr) => {
                      const isActive = addr.id === billingId;
                      return (
                        <TouchableOpacity
                          key={addr.id}
                          style={[styles.addrCard, isActive && styles.addrCardActive]}
                          onPress={() => setBillingAddress(addr.id)}
                          disabled={addrSaving}
                        >
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={styles.addrName}>{addr.name}</Text>
                            <Text style={styles.addrText} numberOfLines={2}>
                              {[addr.address_line1, addr.address_line2, addr.city, addr.state, addr.postal_code]
                                .filter(Boolean).join(', ')}
                            </Text>
                            {addr.is_default && (
                              <Text style={styles.defaultBadge}>Default Delivery</Text>
                            )}
                          </View>
                          <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                            {isActive && <View style={styles.radioInner} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={styles.manageAddrBtn}
                      onPress={() => router.push('/settings/address')}
                    >
                      <MapPin size={14} color="#3C7DC8" />
                      <Text style={styles.manageAddrText}>Manage Addresses</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        )}

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#2C1F13' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  section: {
    backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 16,
    padding: 18, gap: 12,
    borderWidth: 1.5, borderColor: '#1A255C',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e3a5f' },
  sectionSub:   { fontSize: 13, color: '#6b7280', marginTop: -6 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(26,37,92,0.05)', borderRadius: 10, padding: 12,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#1e3a5f' },
  switchSub:   { fontSize: 12, color: '#6b7280', marginTop: 2 },
  fieldLabel:  { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14,
    backgroundColor: '#fafafa', color: '#111827',
  },
  saveBtn: {
    backgroundColor: '#1a6b5a', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyAddrBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, borderRadius: 10,
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
  },
  emptyAddrText: { fontSize: 14, color: '#3C7DC8', fontWeight: '600' },
  addrCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 12, backgroundColor: '#f9fafb',
  },
  addrCardActive: { borderColor: '#1a6b5a', backgroundColor: '#f0fdf4' },
  addrName:       { fontSize: 13, fontWeight: '700', color: '#1e3a5f' },
  addrText:       { fontSize: 12, color: '#6b7280', lineHeight: 16 },
  defaultBadge: {
    alignSelf: 'flex-start', fontSize: 10, fontWeight: '700',
    color: '#1a6b5a', backgroundColor: '#dcfce7',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2,
  },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: '#1a6b5a' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1a6b5a' },
  manageAddrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    borderTopWidth: 1, borderColor: '#e5e7eb',
  },
  manageAddrText: { fontSize: 13, fontWeight: '600', color: '#3C7DC8' },
});
