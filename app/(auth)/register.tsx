import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import api, { VENDOR_ID_KEY, VENDOR_CODE_KEY } from '@/lib/api';
import * as SecureStore from 'expo-secure-store';

const { width: W, height: H } = Dimensions.get('window');
const SX = W / 360;
const SY = H / 640;

const BG        = require('../../assets/Registers.png');
const BACK      = require('../../assets/back.png');
const BACK_SHAPE = require('../../assets/back_register.png');

export default function RegisterScreen() {
  const router = useRouter();

  const [name,         setName]         = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gst,          setGst]          = useState('');
  const [mobile,       setMobile]       = useState('');
  const [email,        setEmail]        = useState('');
  const [location,     setLocation]     = useState('');
  const [password,     setPassword]     = useState('');
  const [loading,      setLoading]      = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !mobile.trim() || password.length < 8) {
      Alert.alert('Validation', 'Please fill in Name, Mobile, and Password (min 8 chars).');
      return;
    }
    if (!businessName.trim()) {
      Alert.alert('Validation', 'Business name is required.');
      return;
    }
    if (!gst.trim()) {
      Alert.alert('Validation', 'GST number is required for B2B registration.');
      return;
    }
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst.trim().toUpperCase())) {
      Alert.alert('Validation', 'Enter a valid 15-character GSTIN (e.g. 27AABCT1234H1Z5).');
      return;
    }
    if (!location.trim() || !location.includes(',')) {
      Alert.alert('Validation', 'Enter City and State separated by a comma (e.g. Delhi, Uttar Pradesh).');
      return;
    }
    setLoading(true);
    try {
      // Parse "City, State" from the location field
      const parts  = location.split(',');
      const city   = parts[0]?.trim() || '';
      const state  = parts[1]?.trim() || '';

      const res = await api.post<{
        success: boolean;
        data: { vendor_id: number; vendor_code: string; token?: string };
      }>('/vendors/register', {
        name:          name.trim(),
        email:         email.trim().toLowerCase() || undefined,
        phone:         mobile.trim(),
        password,
        business_name: businessName.trim(),
        gstin:         gst.trim().toUpperCase(),
        city,
        state,
      });

      // Store vendor_id so pending-approval can poll status
      const vendorId = res.data.data.vendor_id;
      await SecureStore.setItemAsync(VENDOR_ID_KEY, String(vendorId));
      if (res.data.data.vendor_code) {
        await SecureStore.setItemAsync(VENDOR_CODE_KEY, res.data.data.vendor_code);
      }

      router.replace('/(auth)/pending-approval');
    } catch (err: unknown) {
      Alert.alert('Registration Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground source={BG} style={styles.container} resizeMode="cover">
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Image source={BACK_SHAPE} style={styles.backBtnShape} resizeMode="cover" />
          <Image source={BACK} style={styles.backBtnImg} resizeMode="contain" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register</Text>
      </View>

      {/* ── Scrollable form ── */}
      <KeyboardAvoidingView
        style={styles.kvFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Field label="Full Name">
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Asteria Xing"
              placeholderTextColor="rgba(60,80,60,0.6)"
              autoCapitalize="words"
            />
          </Field>

          <Field label="Business Name">
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Asteria Xing's Shop"
              placeholderTextColor="rgba(60,80,60,0.6)"
            />
          </Field>

          <Field label="GST Number *">
            <TextInput
              style={styles.input}
              value={gst}
              onChangeText={(t) => setGst(t.toUpperCase())}
              placeholder="27AABCT1234H1Z5"
              placeholderTextColor="rgba(60,80,60,0.6)"
              autoCapitalize="characters"
              maxLength={15}
            />
          </Field>

          <Field label="Mobile Number">
            <TextInput
              style={styles.input}
              value={mobile}
              onChangeText={setMobile}
              placeholder="+91 8130231669"
              placeholderTextColor="rgba(60,80,60,0.6)"
              keyboardType="phone-pad"
            />
          </Field>

          <Field label="Email Address (optional)">
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="rgba(60,80,60,0.6)"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>

          <Field label="City, State *">
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Delhi, Uttar Pradesh"
              placeholderTextColor="rgba(60,80,60,0.6)"
            />
          </Field>

          <Field label="Create Password">
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 characters"
              placeholderTextColor="rgba(60,80,60,0.6)"
              secureTextEntry
            />
          </Field>

          <Text style={styles.disclaimer}>
            By registering, your account will be reviewed by Ourth team. You'll be notified once approved.
          </Text>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1A5C2E" />
            ) : (
              <Text style={styles.submitText}>Submit for Approval</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7DDCE8',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30 * SY,
    paddingHorizontal: 18 * SX,
    gap: 12 * SX,
  },
  backBtn: {
    width:  45 * SX,
    height: 45 * SX,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnShape: {
    position: 'absolute',
    width:        45 * SX,
    height:       50 * SX,
    borderRadius: 8,
  },
  backBtnImg: {
    width:  20 * SX,
    height: 20 * SX,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize:   26 * SX,
    fontWeight: '700',
    color:      '#1A1A1A',
  },

  // ── Scroll ──
  kvFlex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22 * SX,
    paddingTop:        16 * SY,
    paddingBottom:     16 * SY,
    gap:               7  * SY,
  },

  // ── Field ──
  fieldWrap: {
    gap: 2 * SY,
  },
  label: {
    fontSize:   16 * SX,
    fontWeight: '700',
    fontFamily: 'IBM Plex Sans',
    color:      '#2C1F13',
    paddingLeft: 8 * SX,
  },
  input: {
    height:            34 * SY,
    borderRadius:      10,
    paddingHorizontal: 12 * SX,
    fontSize:          18 * SX,
    fontFamily:        'Poppins',
    fontWeight:        '700',
    color:             '#4A3728',
    backgroundColor:   'rgba(255, 255, 255, 0.12)',
    borderWidth:       1,
    borderColor:       '#6B5A3E',
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.08,
    shadowRadius:      4,
  },


  // ── Disclaimer ──
  disclaimer: {
    fontSize:   10 * SX,
    color:      '#2C1F13',
    lineHeight: 14 * SX,
    marginTop:  2 * SY,
    fontFamily:    'Poppins',
  },

  // ── Submit ──
  submitBtn: {
    height:          44 * SY,
    borderRadius:    12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth:     1,
    borderColor:     'rgba(255, 255, 255, 0.4)',
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       6 * SY,
    width:           200 * SX,
    alignSelf:       'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.15,
    shadowRadius:    8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize:   16 * SX,
    fontWeight: '700',
    color:      '#2C1F13',
  },
});
