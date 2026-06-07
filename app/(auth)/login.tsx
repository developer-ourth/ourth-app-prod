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
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY, VENDOR_ID_KEY, VENDOR_CODE_KEY } from '@/lib/api';

const { width: W, height: H } = Dimensions.get('window');
const SX = W / 360;
const SY = H / 640;

const BG        = require('../../assets/Registers.png');
const BACK      = require('../../assets/back.png');
const BACK_SHAPE = require('../../assets/back_register.png');

export default function LoginScreen() {
  const router  = useRouter();
  const { setUser } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password,    setPassword]   = useState('');
  const [loading,     setLoading]    = useState(false);

  async function handleLogin() {
    const trimmed = identifier.trim();
    if (!trimmed || !password) {
      Alert.alert('Validation', 'Please enter your Phone / Vendor ID and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{
        success: boolean;
        data: { token: string; user: { id: number; name: string; email: string; phone: string | null; role: string; vendor_id: number | null } };
      }>('/auth/login-vendor', { identifier: trimmed, password });

      await SecureStore.setItemAsync(TOKEN_KEY, data.data.token);
      // Store the code they typed — it IS their vendor_code
      await SecureStore.setItemAsync(VENDOR_CODE_KEY, trimmed);
      if (data.data.user.vendor_id) {
        await SecureStore.setItemAsync(VENDOR_ID_KEY, String(data.data.user.vendor_id));
      }
      // Manually hydrate the auth store so the root layout redirects to tabs
      useAuthStore.setState({ token: data.data.token, user: data.data.user });
    } catch (err: unknown) {
      Alert.alert('Login Failed', err instanceof Error ? err.message : 'Something went wrong.');
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
        <Text style={styles.headerTitle}>Login</Text>
      </View>

      {/* ── Form ── */}
      <KeyboardAvoidingView
        style={styles.kvFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.formWrap}>
          {/* Phone / Vendor ID */}
          <Text style={styles.label}>Phone / Vendor ID</Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="+91 98765 43210 or 123456"
            placeholderTextColor="rgba(60,80,60,0.6)"
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={[styles.label, { marginTop: 18 * SY }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Hello@123"
            placeholderTextColor="rgba(60,80,60,0.6)"
            secureTextEntry
          />

          {/* Proceed button */}
          <TouchableOpacity
            style={[styles.proceedBtn, loading && styles.proceedBtnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1A5C2E" />
            ) : (
              <Text style={styles.proceedText}>Proceed</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
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
    marginTop: 48 * SY,
    paddingHorizontal: 18 * SX,
    gap: 12 * SX,
  },
  backBtn: {
    width:  40 * SX,
    height: 40 * SX,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnShape: {
    position: 'absolute',
    width:        50 * SX,
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
    color:      '#1A5C2E',
  },

  // ── Form ──
  kvFlex: { flex: 1 },
  formWrap: {
    flex: 1,
    paddingHorizontal: 22 * SX,
    justifyContent:    'center',
    paddingBottom:     150 * SY,
  },
  label: {
    fontSize:   20 * SX,
    fontWeight: '700',
    color:      '#1A5C2E',
    marginBottom: 6 * SY,
    paddingLeft: 8 * SX,
  },
  input: {
    height:            34 * SY,
    borderRadius:      10,
    paddingHorizontal: 14 * SX,
    fontSize:          18 * SX,
    fontWeight:        '700',
    color:             '#1A5C2E',
    backgroundColor:   'rgba(255, 255, 255, 0.12)',
    borderWidth:       1,
    borderColor:       '#1A5C2E',
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.08,
    shadowRadius:      4,
  },
  inputDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor:     '#1A5C2E',
    color:           '#1A5C2E',
  },

  // ── Proceed button ──
  proceedBtn: {
    height:          50 * SY,
    width:           200 * SX,
    alignSelf:       'center',
    borderRadius:    12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth:     1,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       50 * SY,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.15,
    shadowRadius:    8,
    borderColor: '#1A5C2E',
  },
  proceedBtnDisabled: {
    opacity: 0.6,
  },
  proceedText: {
    fontSize:   18 * SX,
    fontWeight: '700',
    color:      '#1A5C2E',
    
  },
});

