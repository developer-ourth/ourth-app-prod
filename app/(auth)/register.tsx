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
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api, { VENDOR_GSTIN_KEY, VENDOR_ID_KEY, VENDOR_CODE_KEY, TOKEN_KEY } from '@/lib/api';
import * as SecureStore from 'expo-secure-store';
import LocationPickerModal from '@/components/ui/LocationPickerModal';
import { INDIA_STATES, getCitiesForState } from '@/lib/indiaLocations';

const { width: W, height: H } = Dimensions.get('window');
const SX = W / 360;
const SY = H / 640;

const BG        = require('../../assets/Registers.png');
const BACK      = require('../../assets/back.png');
const BACK_SHAPE = require('../../assets/back_register.png');

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name,         setName]         = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gst,          setGst]          = useState('');
  const [mobile,       setMobile]       = useState('');
  const [email,        setEmail]        = useState('');
  const [pincode,      setPincode]      = useState('');
  const [city,         setCity]         = useState('');
  const [state,        setState]        = useState('');
  const [password,     setPassword]     = useState('');
  const [isBusiness,   setIsBusiness]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showCityPicker,  setShowCityPicker]  = useState(false);

  const fetchLocationFromPincode = async (code: string) => {
    // Local offline prefix fallback (e.g. for Gautam Buddha Nagar/Noida 2013xx and Delhi 11xxxx)
    if (code.startsWith('2013')) {
      setState('Uttar Pradesh');
      setCity('Gautam Buddha Nagar');
    } else if (code.startsWith('11')) {
      setState('Delhi');
      setCity('New Delhi');
    }

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${code}`);
      const data = await response.json();
      if (data && data[0] && data[0].Status === 'Success') {
        const postOffice = data[0].PostOffice?.[0];
        if (postOffice) {
          if (postOffice.State) setState(postOffice.State);
          if (postOffice.District) setCity(postOffice.District);
        }
      }
    } catch (error) {
      console.log('Error fetching PIN code details:', error);
    }
  };

  const handlePincodeChange = (text: string) => {
    const filtered = text.replace(/[^0-9]/g, '');
    setPincode(filtered);
    if (filtered.length === 6) {
      void fetchLocationFromPincode(filtered);
    }
  };

  async function handleSubmit() {
    if (!name.trim() || !mobile.trim() || password.length < 8) {
      Alert.alert('Validation', 'Please fill in Name, Mobile, and Password (min 8 chars).');
      return;
    }
    
    setLoading(true);
    try {
      if (isBusiness) {
        if (!businessName.trim()) {
          Alert.alert('Validation', 'Business name is required.');
          setLoading(false);
          return;
        }
        if (gst.trim()) {
          if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst.trim().toUpperCase())) {
            Alert.alert('Validation', 'Enter a valid 15-character GSTIN (e.g. 27AABCT1234H1Z5).');
            setLoading(false);
            return;
          }
        }
        if (pincode.trim() && !/^\d{6}$/.test(pincode.trim())) {
          Alert.alert('Validation', 'Enter a valid 6-digit Pincode.');
          setLoading(false);
          return;
        }
        if (!state.trim() || !city.trim()) {
          Alert.alert('Validation', 'Please select City and State.');
          setLoading(false);
          return;
        }

        const cityVal  = city.trim();
        const stateVal = state.trim();

        const res = await api.post<{
          success: boolean;
          data: { vendor_id: number; vendor_code: string; token?: string };
        }>('/vendors/register', {
          name:          name.trim(),
          email:         email.trim().toLowerCase() || undefined,
          phone:         mobile.trim(),
          password,
          business_name: businessName.trim(),
          gstin:         gst.trim().toUpperCase() || undefined,
          city:          cityVal,
          state:         stateVal,
          postal_code:   pincode.trim() || undefined,
        });

        const vendorId = res.data.data.vendor_id;
        await SecureStore.setItemAsync(VENDOR_ID_KEY, String(vendorId));
        if (res.data.data.vendor_code) {
          await SecureStore.setItemAsync(VENDOR_CODE_KEY, res.data.data.vendor_code);
        }
        if (gst.trim()) {
          await SecureStore.setItemAsync(VENDOR_GSTIN_KEY, gst.trim().toUpperCase());
        } else {
          await SecureStore.deleteItemAsync(VENDOR_GSTIN_KEY);
        }

        router.replace('/(auth)/pending-approval');
      } else {
        const res = await api.post<{
          success: boolean;
          data: { token: string; user: any };
        }>('/auth/register', {
          name: name.trim(),
          email: email.trim().toLowerCase() || `${mobile.trim()}@ourth.com`,
          phone: mobile.trim(),
          password,
          password_confirmation: password,
          role: 'consumer',
        });

        await SecureStore.setItemAsync(TOKEN_KEY, res.data.data.token);
        const { useAuthStore } = await import('@/lib/store');
        useAuthStore.setState({ token: res.data.data.token, user: res.data.data.user, isLoading: false });
        router.replace('/(tabs)');
      }
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
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Image source={BACK_SHAPE} style={styles.backBtnShape} resizeMode="cover" />
          <Image source={BACK} style={styles.backBtnImg} resizeMode="contain" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register</Text>
      </View>

      {/* ── Scrollable form ── */}
      <KeyboardAvoidingView
        style={styles.kvFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 20, 28) }]}
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

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginVertical: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#2C1F13', fontFamily: 'IBM Plex Sans' }}>
              Register as a Business / Vendor
            </Text>
            <Switch
              value={isBusiness}
              onValueChange={setIsBusiness}
              trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
              thumbColor={isBusiness ? '#1a6b5a' : '#9ca3af'}
            />
          </View>

          {isBusiness && (
            <>
              <Field label="Business Name">
                <TextInput
                  style={styles.input}
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="Asteria Xing's Shop"
                  placeholderTextColor="rgba(60,80,60,0.6)"
                />
              </Field>

              <Field label="GST Number (optional)">
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
            </>
          )}

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

          {isBusiness && (
            <>
              <Field label="Pincode (auto-fills City & State)">
                <TextInput
                  style={styles.input}
                  value={pincode}
                  onChangeText={handlePincodeChange}
                  placeholder="e.g. 110001"
                  placeholderTextColor="rgba(60,80,60,0.6)"
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </Field>

              <Field label="City, State *">
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowStatePicker(true)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pickerBtnText, !state && styles.pickerBtnPlaceholder]}>
                    {state || 'Select State'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerBtn, { marginTop: 8 }]}
                  onPress={() => {
                    if (!state) { Alert.alert('Select State', 'Please select a state first.'); return; }
                    setShowCityPicker(true);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pickerBtnText, !city && styles.pickerBtnPlaceholder]}>
                    {city || 'Select City'}
                  </Text>
                </TouchableOpacity>
              </Field>
            </>
          )}

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
            {isBusiness 
              ? "By registering, your account will be reviewed by OURTH team. You'll be notified once approved."
              : "By creating an account you agree to our Terms of Service and Privacy Policy."}
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
              <Text style={styles.submitText}>
                {isBusiness ? "Submit for Approval" : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationPickerModal
        visible={showStatePicker}
        title="Select State"
        options={INDIA_STATES}
        selected={state}
        onSelect={(val) => { setState(val); setCity(''); }}
        onClose={() => setShowStatePicker(false)}
      />
      <LocationPickerModal
        visible={showCityPicker}
        title="Select City"
        options={getCitiesForState(state)}
        selected={city}
        onSelect={setCity}
        onClose={() => setShowCityPicker(false)}
      />
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
    paddingBottom: 6,
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
    height:            46,
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
  pickerBtn: {
    height:            46,
    borderRadius:      10,
    paddingHorizontal: 12 * SX,
    justifyContent:    'center',
    backgroundColor:   'rgba(255, 255, 255, 0.12)',
    borderWidth:       1,
    borderColor:       '#6B5A3E',
  },
  pickerBtnText: {
    fontSize:   18 * SX,
    fontWeight: '700',
    color:      '#4A3728',
    fontFamily: 'Poppins',
  },
  pickerBtnPlaceholder: {
    color: 'rgba(60,80,60,0.6)',
    fontWeight: '400',
  },
});
