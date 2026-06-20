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
import { ChevronLeft, ChevronRight, ArrowUp } from '@/components/icons';
import { addressAPI, type AddressPayload } from '@/lib/api';
import LocationPickerModal from '@/components/ui/LocationPickerModal';
import { INDIA_STATES, getCitiesForState } from '@/lib/indiaLocations';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BG_IMAGE = require('../../assets/Frame16.png');

type Address = {
  id: number;
  name: string;
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  mobile?: string;
  is_default: boolean;
};

const EMPTY_FORM: AddressPayload = {
  name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  mobile: '',
  is_default: false,
};

export default function AddressBookScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Edit / create modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AddressPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showCityPicker,  setShowCityPicker]  = useState(false);

  const fetchLocationFromPincode = async (pincode: string) => {
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      if (data && data[0] && data[0].Status === 'Success') {
        const postOffice = data[0].PostOffice?.[0];
        if (postOffice) {
          const state = postOffice.State;
          const city = postOffice.District;
          setForm((f) => ({
            ...f,
            state: state || f.state,
            city: city || f.city,
          }));
        }
      }
    } catch (error) {
      console.log('Error fetching PIN code details:', error);
    }
  };

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await addressAPI.list();
      setAddresses(res.data.data ?? []);
    } catch {
      Alert.alert('Error', 'Could not load addresses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const toggle = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (addr: Address) => {
    setEditingId(addr.id);
    setForm({
      name: addr.name,
      address_line1: addr.address_line1,
      address_line2: addr.address_line2 ?? '',
      city: addr.city ?? '',
      state: addr.state ?? '',
      postal_code: addr.postal_code ?? '',
      mobile: addr.mobile ?? '',
      is_default: addr.is_default,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.address_line1.trim()) {
      Alert.alert('Validation', 'Name and Address Line 1 are required.');
      return;
    }
    
    if (form.postal_code && form.postal_code.trim().length !== 6) {
      Alert.alert('Validation', 'PIN Code must be exactly 6 digits.');
      return;
    }

    if (form.mobile && form.mobile.trim().length !== 10) {
      Alert.alert('Validation', 'Mobile number must be exactly 10 digits.');
      return;
    }

    const payload: AddressPayload = {
      ...form,
      address_line2: form.address_line2?.trim() || undefined,
      postal_code: form.postal_code?.trim() || undefined,
      mobile: form.mobile?.trim() || undefined,
    };

    setSaving(true);
    try {
      if (editingId !== null) {
        await addressAPI.update(editingId, payload);
      } else {
        await addressAPI.create(payload);
      }
      setModalVisible(false);
      await fetchAddresses();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save address.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await addressAPI.remove(id);
            setAddresses((prev) => prev.filter((a) => a.id !== id));
            if (expandedId === id) {
              setExpandedId(null);
            }
          } catch {
            Alert.alert('Error', 'Could not delete address.');
          }
        },
      },
    ]);
  };

  return (
    <ImageBackground source={BG_IMAGE} style={styles.screen} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Address Book</Text>
          <TouchableOpacity style={styles.addCircle} onPress={openCreate}>
            <Text style={styles.addCircleText}>+</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#4A9B5F" style={{ marginTop: 40 }} />
        ) : addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No saved addresses yet.</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
              <Text style={styles.addBtnText}>+ Add Address</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {addresses.map((addr) => {
              const isOpen = expandedId === addr.id;
              return (
                <LinearGradient
                  key={addr.id}
                  colors={['rgba(60,125,200,0.5)', 'rgba(138,239,242,0.5)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.item}
                >
                  <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
                  <TouchableOpacity
                    style={styles.itemRow}
                    onPress={() => toggle(addr.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.itemName}>
                      {addr.name}
                      {addr.is_default ? '  ★' : ''}
                    </Text>
                    {isOpen ? (
                      <ArrowUp size={20} color="#374151" />
                    ) : (
                      <ChevronRight size={20} color="#374151" />
                    )}
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.expandedContent}>
                      <Text style={styles.addressText}>
                        {[addr.address_line1, addr.address_line2, addr.city, addr.state, addr.postal_code]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                      {addr.mobile ? (
                        <Text style={styles.mobileText}>Mobile: {addr.mobile}</Text>
                      ) : null}

                      <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(addr)}>
                          <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(addr.id)}>
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </LinearGradient>
              );
            })}
          </ScrollView>
        )}

      </SafeAreaView>

      {/* Edit / Create Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Address' : 'Add Address'}</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {(
                [
                  { key: 'name', label: 'Name / Label *', placeholder: "e.g. Raju's Shop" },
                  { key: 'address_line1', label: 'Address Line 1 *', placeholder: 'Street, building, floor…' },
                  { key: 'address_line2', label: 'Address Line 2', placeholder: 'Landmark, area…' },
                  { key: 'postal_code', label: 'PIN Code', placeholder: '560038' },
                  { key: 'mobile', label: 'Mobile', placeholder: '+91 98765 43210' },
                ] as { key: keyof AddressPayload; label: string; placeholder: string }[]
              ).map(({ key, label, placeholder }) => (
                <View key={key} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#9ca3af"
                    value={String(form[key] ?? '')}
                    onChangeText={(val) => {
                      let filtered = val;
                      if (key === 'mobile' || key === 'postal_code') {
                        filtered = val.replace(/[^0-9]/g, '');
                      }
                      setForm((f) => ({ ...f, [key]: filtered }));
                      if (key === 'postal_code' && filtered.length === 6) {
                        fetchLocationFromPincode(filtered);
                      }
                    }}
                    keyboardType={key === 'mobile' || key === 'postal_code' ? 'phone-pad' : 'default'}
                    maxLength={key === 'mobile' ? 10 : key === 'postal_code' ? 6 : undefined}
                  />
                </View>
              ))}

              {/* State picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>State</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowStatePicker(true)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pickerBtnText, !form.state && styles.pickerBtnPlaceholder]}>
                    {form.state || 'Select State'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* City picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>City</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => {
                    if (!form.state) { return; }
                    setShowCityPicker(true);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pickerBtnText, !form.city && styles.pickerBtnPlaceholder]}>
                    {form.city || (form.state ? 'Select City' : 'Select State first')}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.defaultToggle}
                onPress={() => setForm((f) => ({ ...f, is_default: !f.is_default }))}
              >
                <View style={[styles.checkbox, form.is_default && styles.checkboxChecked]} />
                <Text style={styles.defaultLabel}>Set as default address</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        <LocationPickerModal
          visible={showStatePicker}
          title="Select State"
          options={INDIA_STATES}
          selected={form.state ?? ''}
          onSelect={(val) => { setForm((f) => ({ ...f, state: val, city: '' })); setShowStatePicker(false); }}
          onClose={() => setShowStatePicker(false)}
        />
        <LocationPickerModal
          visible={showCityPicker}
          title="Select City"
          options={getCitiesForState(form.state ?? '')}
          selected={form.city ?? ''}
          onSelect={(val) => { setForm((f) => ({ ...f, city: val })); setShowCityPicker(false); }}
          onClose={() => setShowCityPicker(false)}
        />
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#2C1F13' },
  addCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4A9B5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircleText: { color: '#fff', fontSize: 22, lineHeight: 26 },

  listContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 15, color: '#374151' },
  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#4A9B5F',
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  item: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1A255C',
    overflow: 'hidden',
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemName: { fontSize: 15, fontWeight: '600', color: '#4A9B5F', flex: 1 },

  expandedContent: { paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
  addressText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  mobileText: { fontSize: 13, color: '#374151' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  editBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#3C7DC8',
    alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  deleteBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(200,50,50,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,50,50,0.4)',
    alignItems: 'center',
  },
  deleteBtnText: { color: '#b91c1c', fontWeight: '600', fontSize: 13 },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#4A9B5F', marginBottom: 16 },

  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },

  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 4 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#4A9B5F', borderColor: '#4A9B5F' },
  defaultLabel: { fontSize: 13, color: '#374151' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4A9B5F',
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  pickerBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#f9fafb',
  },
  pickerBtnText: { fontSize: 14, color: '#111827' },
  pickerBtnPlaceholder: { color: '#9ca3af' },
});
