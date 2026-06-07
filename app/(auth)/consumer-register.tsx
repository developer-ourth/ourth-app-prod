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
import { useAuthStore } from '@/lib/store';

const { width: W, height: H } = Dimensions.get('window');
const SX = W / 360;
const SY = H / 640;

const BG         = require('../../assets/Registers.png');
const BACK       = require('../../assets/back.png');
const BACK_SHAPE = require('../../assets/back_register.png');

export default function ConsumerRegisterScreen() {
  const router = useRouter();
  const { register } = useAuthStore();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Validation', 'Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Validation', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Validation', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password, 'consumer');
      // register() sets the token + user in the store → root layout will redirect to tabs
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      Alert.alert('Registration Failed', msg);
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
        <Text style={styles.headerTitle}>Create Account</Text>
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
              placeholder="Your name"
              placeholderTextColor="rgba(60,80,60,0.6)"
              autoCapitalize="words"
            />
          </Field>

          <Field label="Email Address">
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="rgba(60,80,60,0.6)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Field label="Mobile Number (optional)">
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 9876543210"
              placeholderTextColor="rgba(60,80,60,0.6)"
              keyboardType="phone-pad"
            />
          </Field>

          <Field label="Password">
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 characters"
              placeholderTextColor="rgba(60,80,60,0.6)"
              secureTextEntry
            />
          </Field>

          <Field label="Confirm Password">
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat your password"
              placeholderTextColor="rgba(60,80,60,0.6)"
              secureTextEntry
            />
          </Field>

          <Text style={styles.disclaimer}>
            By creating an account you agree to our Terms of Service and Privacy Policy.
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
              <Text style={styles.submitText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/consumer-login')} activeOpacity={0.7}>
            <Text style={styles.loginLink}>Already have an account? <Text style={styles.loginLinkBold}>Sign in</Text></Text>
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
  container: { flex: 1, backgroundColor: '#7DDCE8' },

  header: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       30 * SY,
    paddingHorizontal: 18 * SX,
    gap:             12 * SX,
  },
  backBtn: {
    width:  45 * SX,
    height: 45 * SX,
    justifyContent: 'center',
    alignItems:     'center',
  },
  backBtnShape: {
    position:     'absolute',
    width:        45 * SX,
    height:       50 * SX,
    borderRadius: 8,
  },
  backBtnImg: {
    width:  20 * SX,
    height: 20 * SX,
  },
  headerTitle: {
    fontSize:   26 * SX,
    fontWeight: '700',
    color:      '#1A1A1A',
  },

  kvFlex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22 * SX,
    paddingTop:        16 * SY,
    paddingBottom:     32 * SY,
    gap:               7  * SY,
  },

  fieldWrap: { gap: 2 * SY },
  label: {
    fontSize:    16 * SX,
    fontWeight:  '700',
    fontFamily:  'IBM Plex Sans',
    color:       '#2C1F13',
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

  disclaimer: {
    fontSize:   10 * SX,
    color:      '#2C1F13',
    lineHeight: 14 * SX,
    marginTop:  2 * SY,
    fontFamily: 'Poppins',
  },

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
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    fontSize:   16 * SX,
    fontWeight: '700',
    color:      '#2C1F13',
  },

  loginLink: {
    textAlign:  'center',
    fontSize:   13 * SX,
    color:      '#2C1F13',
    marginTop:  8 * SY,
    fontFamily: 'Poppins',
  },
  loginLinkBold: { fontWeight: '700' },
});
