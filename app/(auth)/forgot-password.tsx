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
import api, { authAPI } from '@/lib/api';
import { Eye, EyeOff } from '@/components/icons';

const { width: W, height: H } = Dimensions.get('window');
const SX = W / 360;
const SY = H / 640;

const BG         = require('../../assets/Registers.png');
const BACK       = require('../../assets/back.png');
const BACK_SHAPE = require('../../assets/back_register.png');

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<'request' | 'verify'>('request');

  const [identifier, setIdentifier] = useState('');
  const [targetType, setTargetType] = useState<'email' | 'phone'>('email');
  const [otp, setOtp]               = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);

  // Step 1: Send OTP
  async function handleSendOtp() {
    const trimmed = identifier.trim();
    if (!trimmed) {
      Alert.alert('Validation', 'Please enter your email address or 10-digit mobile number.');
      return;
    }

    const isEmail = trimmed.includes('@');
    setLoading(true);

    if (isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. name@example.com).');
        setLoading(false);
        return;
      }

      setTargetType('email');
      try {
        await api.post('/auth/otp/send-email', { email: trimmed.toLowerCase() });
        setStep('verify');
        Alert.alert('OTP Sent', `A 6-digit OTP has been sent to ${trimmed}. Please check your email inbox.`);
      } catch (err: any) {
        Alert.alert('Send Failed', err?.response?.data?.message || err.message || 'Could not send OTP to email. Please verify your email or try using your 10-digit mobile number.');
      } finally {
        setLoading(false);
      }
    } else {
      const cleanedPhone = trimmed.replace(/\D/g, '');
      if (cleanedPhone.length !== 10) {
        Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
        setLoading(false);
        return;
      }

      setTargetType('phone');
      try {
        await api.post('/auth/otp/send-phone', { phone: cleanedPhone });
        setStep('verify');
        Alert.alert('OTP Sent', `A 6-digit OTP has been sent to ${cleanedPhone}.`);
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || err.message || 'Could not send OTP to phone.');
      } finally {
        setLoading(false);
      }
    }
  }

  // Step 2: Verify OTP & Reset Password
  async function handleResetPassword() {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      Alert.alert('Validation', 'Please enter the 6-digit OTP.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Validation', 'New password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    const identifierVal = targetType === 'phone' ? identifier.replace(/\D/g, '') : identifier.trim().toLowerCase();

    try {
      // Call reset-password-otp which verifies OTP AND resets password atomically
      await api.post('/auth/reset-password-otp', {
        identifier: identifierVal,
        type: targetType,
        otp: trimmedOtp,
        password: newPassword,
      });

      Alert.alert('Success', 'Your password has been reset successfully!', [
        { text: 'Back to Sign In', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Reset Failed', err?.response?.data?.message || err?.message || 'Password reset failed. Please check your OTP and try again.');
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
          {step === 'request' ? (
            <>
              <Text style={styles.description}>
                Enter the email address or 10-digit mobile number associated with your account. We will send an OTP code to verify your identity.
              </Text>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Email Address or Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="you@example.com or 10-digit number"
                  placeholderTextColor="rgba(60,80,60,0.6)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSendOtp}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1A5C2E" />
                ) : (
                  <Text style={styles.submitText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.description}>
                Enter the 6-digit OTP code sent to{' '}
                <Text style={{ fontWeight: '700' }}>{identifier}</Text> and create your new password.
              </Text>

              <View style={styles.fieldWrap}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.label}>Enter 6-Digit OTP</Text>
                  <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                    <Text style={{ fontSize: 13 * SX, fontWeight: '700', color: '#0D3A27', paddingRight: 4 * SX }}>
                      Resend OTP
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  placeholderTextColor="rgba(60,80,60,0.6)"
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>New Password</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, paddingRight: 44 * SX }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Min. 8 characters"
                    placeholderTextColor="rgba(60,80,60,0.6)"
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      right: 12 * SX,
                      height: '100%',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {showPassword ? <EyeOff size={20} color="#1A5C2E" /> : <Eye size={20} color="#1A5C2E" />}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleResetPassword}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1A5C2E" />
                ) : (
                  <Text style={styles.submitText}>Reset Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{ alignSelf: 'center', marginTop: 10 }}
                onPress={() => setStep('request')}
              >
                <Text style={{ color: '#0D3A27', fontWeight: '700', fontSize: 14 * SX }}>
                  ← Change Email / Phone
                </Text>
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
