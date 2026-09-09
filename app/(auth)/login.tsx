import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY, VENDOR_ID_KEY, VENDOR_CODE_KEY } from '@/lib/api';
import auth from '@react-native-firebase/auth';

const { width: W, height: H } = Dimensions.get('window');
const SX = W / 360;
const SY = H / 640;

const BG        = require('../../assets/Registers.png');
const BACK      = require('../../assets/back.png');
const BACK_SHAPE = require('../../assets/back_register.png');
const LOGO      = require('../../assets/logof.png');

export default function LoginScreen() {
  const router  = useRouter();
  const insets = useSafeAreaInsets();
  
  const [tab, setTab] = useState<'password' | 'otp'>('password');

  // Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // OTP state
  const [otpType, setOtpType] = useState<'phone' | 'email'>('phone');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  // --- PASSWORD LOGIN ---
  async function handlePasswordLogin() {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      Alert.alert('Validation', 'Please enter your email/phone and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: trimmed, password });
      await handleSuccessfulAuth(data);
    } catch (err: any) {
      Alert.alert('Login Failed', err?.response?.data?.message || err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // --- OTP LOGIN ---
  async function handleSendOtp() {
    const trimmed = identifier.trim();
    if (!trimmed) {
      Alert.alert('Validation', `Please enter a valid ${otpType === 'phone' ? 'phone number' : 'email'}.`);
      return;
    }

    setLoading(true);
    try {
      if (otpType === 'phone') {
        await api.post('/auth/otp/send-phone', { phone: trimmed });
        setOtpSent(true);
        Alert.alert('Success', 'OTP sent to your mobile number!');
      } else {
        // Email OTP via backend
        await api.post('/auth/otp/send-email', { email: trimmed });
        setOtpSent(true);
        Alert.alert('Success', 'OTP sent to your email!');
      }
    } catch (err: any) {
      Alert.alert('Failed to send OTP', err?.response?.data?.message || err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) {
      Alert.alert('Validation', 'Please enter the OTP.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/otp/verify', {
        identifier: identifier.trim(),
        otp: otp.trim(),
        type: otpType
      });

      if (data.requires_profile_completion) {
        // Navigate to complete profile
        router.push({
          pathname: '/(auth)/complete-profile',
          params: { identifier: identifier.trim(), type: otpType }
        });
      } else {
        await handleSuccessfulAuth(data);
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.response?.data?.message || err.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSuccessfulAuth(data: any) {
    await SecureStore.setItemAsync(TOKEN_KEY, data.data.token);
    if (data.data.user.vendor_id) {
      await SecureStore.setItemAsync(VENDOR_ID_KEY, String(data.data.user.vendor_id));
    }
    useAuthStore.setState({ token: data.data.token, user: data.data.user, isLoading: false });
    router.replace('/(tabs)');
  }

  return (
    <ImageBackground source={BG} style={styles.container} resizeMode="cover">
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Image source={BACK_SHAPE} style={styles.backBtnShape} resizeMode="cover" />
          <Image source={BACK} style={styles.backBtnImg} resizeMode="contain" />
        </TouchableOpacity>
        <Image source={LOGO} style={{ width: 130, height: 36 }} resizeMode="contain" />
      </View>

      <KeyboardAvoidingView style={styles.kvFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.formWrap, { paddingBottom: Math.max(insets.bottom + 20, 32) }]} keyboardShouldPersistTaps="handled">
          
          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tab, tab === 'password' && styles.activeTab]} onPress={() => setTab('password')}>
              <Text style={[styles.tabText, tab === 'password' && styles.activeTabText]}>Password</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'otp' && styles.activeTab]} onPress={() => setTab('otp')}>
              <Text style={[styles.tabText, tab === 'otp' && styles.activeTabText]}>OTP</Text>
            </TouchableOpacity>
          </View>

          {tab === 'password' ? (
            <>
              <Text style={styles.label}>Email / Phone</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email or Phone Number" placeholderTextColor="rgba(60,80,60,0.6)" autoCapitalize="none" />
              
              <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="rgba(60,80,60,0.6)" secureTextEntry />
              
              <TouchableOpacity style={[styles.proceedBtn, loading && styles.disabledBtn]} onPress={handlePasswordLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#1A5C2E" /> : <Text style={styles.proceedText}>Sign In</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {!otpSent && (
                <View style={styles.otpTypeContainer}>
                  <TouchableOpacity style={[styles.otpTypeBtn, otpType === 'phone' && styles.otpTypeActive]} onPress={() => { setOtpType('phone'); setIdentifier(''); }}>
                    <Text style={styles.otpTypeText}>Phone</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.otpTypeBtn, otpType === 'email' && styles.otpTypeActive]} onPress={() => { setOtpType('email'); setIdentifier(''); }}>
                    <Text style={styles.otpTypeText}>Email</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.label}>{otpType === 'phone' ? 'Phone Number' : 'Email Address'}</Text>
              <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier} placeholder={otpType === 'phone' ? '+919876543210' : 'you@example.com'} placeholderTextColor="rgba(60,80,60,0.6)" editable={!otpSent} autoCapitalize="none" keyboardType={otpType === 'phone' ? 'phone-pad' : 'email-address'} />

              {otpSent && (
                <>
                  <Text style={[styles.label, { marginTop: 16 }]}>Enter OTP</Text>
                  <TextInput style={styles.input} value={otp} onChangeText={setOtp} placeholder="123456" placeholderTextColor="rgba(60,80,60,0.6)" keyboardType="number-pad" />
                  
                  <TouchableOpacity style={[styles.proceedBtn, loading && styles.disabledBtn]} onPress={handleVerifyOtp} disabled={loading}>
                    {loading ? <ActivityIndicator color="#1A5C2E" /> : <Text style={styles.proceedText}>Verify & Login</Text>}
                  </TouchableOpacity>
                </>
              )}

              {!otpSent && (
                <TouchableOpacity style={[styles.proceedBtn, loading && styles.disabledBtn]} onPress={handleSendOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color="#1A5C2E" /> : <Text style={styles.proceedText}>Send OTP</Text>}
                </TouchableOpacity>
              )}
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#7DDCE8' },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, paddingHorizontal: 18 * SX, gap: 12 * SX },
  backBtn: { width: 40 * SX, height: 40 * SX, justifyContent: 'center', alignItems: 'center' },
  backBtnShape: { position: 'absolute', width: 50 * SX, height: 50 * SX, borderRadius: 8 },
  backBtnImg: { width: 20 * SX, height: 20 * SX, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 26 * SX, fontWeight: '700', color: '#1A5C2E' },
  kvFlex: { flex: 1 },
  formWrap: { paddingHorizontal: 22 * SX, paddingTop: 24 },
  
  tabContainer: { flexDirection: 'row', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(26, 92, 46, 0.2)' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#1A5C2E' },
  tabText: { fontSize: 16 * SX, fontWeight: '600', color: 'rgba(26, 92, 46, 0.6)' },
  activeTabText: { color: '#1A5C2E', fontWeight: '700' },

  otpTypeContainer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  otpTypeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#1A5C2E', backgroundColor: 'transparent' },
  otpTypeActive: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  otpTypeText: { color: '#1A5C2E', fontWeight: '700' },

  label: { fontSize: 20 * SX, fontWeight: '700', color: '#1A5C2E', marginBottom: 6 * SY, paddingLeft: 8 * SX },
  input: { height: 46, borderRadius: 10, paddingHorizontal: 14 * SX, fontSize: 18 * SX, fontWeight: '700', color: '#1A5C2E', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderWidth: 1, borderColor: '#1A5C2E' },
  
  proceedBtn: { height: 50, width: 200 * SX, alignSelf: 'center', borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: '#1A5C2E', alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  disabledBtn: { opacity: 0.6 },
  proceedText: { fontSize: 18 * SX, fontWeight: '700', color: '#1A5C2E' },
});
