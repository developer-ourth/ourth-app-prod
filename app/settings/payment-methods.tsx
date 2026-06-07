import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Trash2 } from '@/components/icons';
import { paymentMethodAPI, type PaymentMethodPayload } from '@/lib/api';
import type { PaymentMethod, PaymentMethodType } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BG_IMAGE = require('../../assets/Frame16.png');

const METHOD_LABELS: Record<PaymentMethodType, string> = {
  upi:        'UPI',
  card:       'Credit / Debit Card',
  netbanking: 'Net Banking',
  wallet:     'Wallet',
  cod:        'Cash on Delivery',
};

const METHOD_ICONS: Record<PaymentMethodType, string> = {
  upi:        '📲',
  card:       '💳',
  netbanking: '🏦',
  wallet:     '👛',
  cod:        '💵',
};

const METHOD_TYPES: PaymentMethodType[] = ['upi', 'card', 'netbanking', 'wallet', 'cod'];

const EMPTY_FORM: PaymentMethodPayload = {
  type:       'upi',
  provider:   '',
  identifier: '',
  is_default: false,
};

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const [methods, setMethods]       = useState<PaymentMethod[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState<PaymentMethodPayload>(EMPTY_FORM);

  const fetchMethods = useCallback(async () => {
    try {
      const res = await paymentMethodAPI.list();
      setMethods(res.data?.data ?? res.data ?? []);
    } catch {
      Alert.alert('Error', 'Could not load payment methods.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const openAdd = () => { setForm(EMPTY_FORM); setShowModal(true); };

  const handleSave = async () => {
    if (!form.identifier?.trim() && form.type !== 'cod') {
      Alert.alert('Validation', 'Please enter your UPI ID / account number.');
      return;
    }
    setSaving(true);
    try {
      await paymentMethodAPI.create(form);
      await fetchMethods();
      setShowModal(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await paymentMethodAPI.update(id, { is_default: true });
      await fetchMethods();
    } catch {}
  };

  const handleDelete = (id: number) => {
    Alert.alert('Remove', 'Remove this payment method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await paymentMethodAPI.remove(id);
            setMethods(prev => prev.filter(m => m.id !== id));
          } catch {}
        },
      },
    ]);
  };

  const identifierLabel = (type: PaymentMethodType) => {
    if (type === 'upi')   return 'UPI ID (e.g. name@upi)';
    if (type === 'card')  return 'Last 4 digits';
    if (type === 'wallet') return 'Registered mobile / email';
    if (type === 'netbanking') return 'Account number (optional)';
    return '';
  };

  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Methods</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Plus size={18} color="#1a6b5a" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#1a6b5a" /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {methods.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>💳</Text>
                <Text style={styles.emptyTitle}>No payment methods saved</Text>
                <Text style={styles.emptySub}>Tap + to add a UPI ID, card, or wallet</Text>
              </View>
            )}

            {methods.map((m) => (
              <View key={m.id} style={styles.card}>
                <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(60,125,200,0.28)', 'rgba(138,239,242,0.28)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill} pointerEvents="none"
                />
                <View style={styles.cardLeft}>
                  <Text style={styles.cardIcon}>{METHOD_ICONS[m.type]}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardType}>{METHOD_LABELS[m.type]}</Text>
                    {m.provider && <Text style={styles.cardProvider}>{m.provider}</Text>}
                    {m.identifier && <Text style={styles.cardId}>{m.identifier}</Text>}
                    {m.is_default && <Text style={styles.defaultBadge}>Default</Text>}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  {!m.is_default && (
                    <TouchableOpacity style={styles.setDefaultBtn} onPress={() => handleSetDefault(m.id)}>
                      <Text style={styles.setDefaultText}>Set Default</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(m.id)} style={styles.deleteBtn}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Add Modal */}
        <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Payment Method</Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Type selector */}
                  <Text style={styles.fieldLabel}>Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                    {METHOD_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeChip, form.type === t && styles.typeChipActive]}
                        onPress={() => setForm(f => ({ ...f, type: t, identifier: '', provider: '' }))}
                      >
                        <Text style={{ fontSize: 16 }}>{METHOD_ICONS[t]}</Text>
                        <Text style={[styles.typeChipText, form.type === t && styles.typeChipTextActive]}>
                          {METHOD_LABELS[t]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Provider */}
                  {form.type !== 'cod' && (
                    <>
                      <Text style={styles.fieldLabel}>
                        {form.type === 'upi' ? 'App (e.g. Paytm, GPay)' : 'Bank / Provider'}
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Google Pay"
                        value={form.provider}
                        onChangeText={(v) => setForm(f => ({ ...f, provider: v }))}
                      />
                    </>
                  )}

                  {/* Identifier */}
                  {form.type !== 'cod' && (
                    <>
                      <Text style={styles.fieldLabel}>{identifierLabel(form.type)}</Text>
                      <TextInput
                        style={styles.input}
                        placeholder={identifierLabel(form.type)}
                        value={form.identifier}
                        onChangeText={(v) => setForm(f => ({ ...f, identifier: v }))}
                        autoCapitalize="none"
                        keyboardType={form.type === 'card' ? 'number-pad' : 'default'}
                      />
                    </>
                  )}

                  {/* Default */}
                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => setForm(f => ({ ...f, is_default: !f.is_default }))}
                  >
                    <View style={[styles.checkbox, form.is_default && styles.checkboxChecked]}>
                      {form.is_default && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                    <Text style={styles.checkLabel}>Set as default payment method</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.saveBtnText}>Save</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

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
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  emptyBox: {
    alignItems: 'center', gap: 8, paddingVertical: 48,
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 18, marginTop: 16,
  },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#2C1F13' },
  emptySub:   { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  card: {
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#1A255C',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  cardLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon:    { fontSize: 28 },
  cardType:    { fontSize: 14, fontWeight: '700', color: '#1e3a5f' },
  cardProvider:{ fontSize: 12, color: '#374151' },
  cardId:      { fontSize: 12, color: '#6b7280' },
  defaultBadge:{
    alignSelf: 'flex-start', fontSize: 10, fontWeight: '700',
    color: '#1a6b5a', backgroundColor: '#dcfce7',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2,
  },
  cardActions:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setDefaultBtn:{ backgroundColor: '#1a6b5a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  setDefaultText:{ color: '#fff', fontSize: 11, fontWeight: '700' },
  deleteBtn:    { padding: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:  { fontSize: 17, fontWeight: '700', color: '#1e3a5f' },
  modalClose:  { fontSize: 18, color: '#6b7280', paddingHorizontal: 4 },
  fieldLabel:  { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f9fafb',
  },
  typeChipActive:     { borderColor: '#1a6b5a', backgroundColor: '#f0fdf4' },
  typeChipText:       { fontSize: 13, color: '#6b7280' },
  typeChipTextActive: { color: '#1a6b5a', fontWeight: '700' },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14,
    backgroundColor: '#fafafa', marginBottom: 16, color: '#111827',
  },
  checkRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#1a6b5a', borderColor: '#1a6b5a' },
  checkMark:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { fontSize: 14, color: '#374151' },
  saveBtn: {
    backgroundColor: '#1a6b5a', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
