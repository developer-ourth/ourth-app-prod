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
import { authAPI } from '@/lib/api';

const { width: W, height: H } = Dimensions.get('window');
const SX = W / 360;
const SY = H / 640;

const BG         = require('../../assets/Registers.png');
const BACK       = require('../../assets/back.png');
const BACK_SHAPE = require('../../assets/back_register.png');

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!email.trim()) {
      Alert.alert('Validation', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not send reset email. Please try again.');
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
        <Text style={styles.headerTitle}>Reset Password</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.kvFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.formWrap}>
          {sent ? (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successBody}>
                We sent a password reset link to{'\n'}
                <Text style={styles.successEmail}>{email}</Text>
              </Text>
              <TouchableOpacity style={styles.submitBtn} onPress={() => router.back()} activeOpacity={0.8}>
                <Text style={styles.submitText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.description}>
                Enter the email address associated with your account and we'll send you a link to reset your password.
              </Text>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Email Address</Text>
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
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSend}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1A5C2E" />
                ) : (
                  <Text style={styles.submitText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#7DDCE8' },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    marginTop:         30 * SY,
    paddingHorizontal: 18 * SX,
    gap:               12 * SX,
  },
  backBtn: {
    width:          45 * SX,
    height:         45 * SX,
    justifyContent: 'center',
    alignItems:     'center',
  },
  backBtnShape: {
    position:     'absolute',
    width:        45 * SX,
    height:       50 * SX,
    borderRadius: 8,
  },
  backBtnImg: { width: 20 * SX, height: 20 * SX },
  headerTitle: {
    fontSize:   26 * SX,
    fontWeight: '700',
    color:      '#1A1A1A',
  },

  kvFlex: { flex: 1 },
  formWrap: {
    flex:              1,
    paddingHorizontal: 22 * SX,
    paddingTop:        32 * SY,
    gap:               16 * SY,
  },

  description: {
    fontSize:   14 * SX,
    color:      '#2C1F13',
    lineHeight: 22 * SX,
    fontFamily: 'Poppins',
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

  successBox:   { alignItems: 'center', gap: 12 * SY },
  successTitle: {
    fontSize:   22 * SX,
    fontWeight: '700',
    color:      '#1A5C2E',
    fontFamily: 'Poppins',
  },
  successBody: {
    fontSize:   14 * SX,
    color:      '#2C1F13',
    textAlign:  'center',
    lineHeight: 22 * SX,
    fontFamily: 'Poppins',
  },
  successEmail: { fontWeight: '700' },
});
