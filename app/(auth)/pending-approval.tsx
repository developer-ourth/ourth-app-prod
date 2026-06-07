import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import api, { TOKEN_KEY, VENDOR_ID_KEY, VENDOR_CODE_KEY } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const { width: W, height: H } = Dimensions.get('window');
const SX = W / 360;
const SY = H / 640;

const BG   = require('../../assets/approvalp.png');
const LOGO = require('../../assets/logo.png');

const STEPS = [
  { label: 'Registration submitted successfully', activeColor: '#F0DC8C' },
  { label: 'Backend team reviewing your details',  activeColor: '#C8E898' },
  { label: 'Account activation & welcome kit',     activeColor: '#8FCCA8' },
] as const;

export default function PendingApprovalScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = registered, 2 = reviewing, 3 = approved
  const [vendorCode, setVendorCode] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let storedVendorId: string | null = null;

    async function fetchStatus() {
      try {
        // Prefer auth token (faster), fallback to vendor_id for post-registration polling
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          const res = await api.get<{
            success: boolean;
            step: number;
            approval_stage: string;
          }>('/auth/vendor-status');
          if (res.data.success) {
            setStep(res.data.step);
            if (res.data.step >= 3) {
              clearInterval(pollRef.current!);
              // Small delay so the user sees step 3 light up before redirect
              setTimeout(() => router.replace('/(tabs)'), 2000);
            }
          }
        } else if (storedVendorId) {
          // No token yet (just registered), poll public status endpoint
          const res = await api.get<{
            success: boolean;
            data: { approval_stage: string; kyc_status: string };
          }>(`/vendors/${storedVendorId}/approval-status`);
          if (res.data.success) {
            const stage = res.data.data.approval_stage;
            const newStep = stage === 'approved' ? 3 : stage === 'under_review' ? 2 : 1;
            setStep(newStep);
          }
        }
      } catch {
        // Silent — network errors shouldn't crash the screen
      }
    }

    (async () => {
      storedVendorId = await SecureStore.getItemAsync(VENDOR_ID_KEY);
      const code = await SecureStore.getItemAsync(VENDOR_CODE_KEY);
      if (code) setVendorCode(code);
      fetchStatus();
      pollRef.current = setInterval(fetchStatus, 5000);
    })();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <ImageBackground source={BG} style={styles.container} resizeMode="cover">
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── Logo ── */}
      <Image
        source={LOGO}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* ── Pending badge ── */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>PENDING APPROVAL</Text>
      </View>

      {/* ── Vendor ID chip ── */}
      {vendorCode ? (
        <View style={styles.vendorIdChip}>
          <Text style={styles.vendorIdLabel}>Your Vendor ID </Text>
          <Text style={styles.vendorIdValue}>{vendorCode}</Text>
        </View>
      ) : null}

      {/* ── Heading ── */}
      <Text style={styles.heading}>Hang tight,{'\n'}we're reviewing you!</Text>

      {/* ── Subtext ── */}
      <Text style={styles.subtext}>
        You'll receive an SMS and email once{'\n'}approved.
      </Text>

      {/* ── Status steps ── */}
      <View style={styles.stepsWrap}>
        {STEPS.map((s, i) => {
          const isActive = step > i;
          return (
            <View
              key={i}
              style={[
                styles.stepRow,
                isActive
                  ? { backgroundColor: s.activeColor, borderColor: 'rgba(255,255,255,0.6)' }
                  : { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.25)' },
              ]}
            >
              <View style={[styles.dot, isActive && styles.dotActive]} />
              <Text style={[styles.stepText, isActive && styles.stepTextActive]}>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Log in button ── */}
      <TouchableOpacity
        style={styles.loginBtn}
        onPress={() => router.replace('/(auth)/login')}
        activeOpacity={0.8}
      >
        <Text style={styles.loginText}>Log in</Text>
      </TouchableOpacity>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#A8D5BA',
    alignItems: 'center',
  },

  // ── Logo ──
  logo: {
    width:  170 * SX,
    height: 170 * SX,
    marginTop: 50 * SY,
    borderRadius: 12,
  },

  // ── Badge ──
  badge: {
    marginTop:    16 * SY,
    paddingVertical:   6 * SY,
    paddingHorizontal: 20 * SX,
    borderRadius: 10,
    borderWidth:  1,
    borderColor:  'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  badgeText: {
    fontSize:    14 * SX,
    fontWeight:  '700',
    color:       '#2C1F13',
    fontFamily: 'IBM Plex Sans',
    letterSpacing: 1,
  },

  // ── Heading ──
  heading: {
    marginTop:  20 * SY,
    fontSize:   34,
    fontWeight: '800',
    color:      '#2C1F13',
    fontFamily: 'Poppins',
    textAlign:  'center',
    lineHeight: 34 * SX,
    paddingHorizontal: 20 * SX,
  },

  // ── Subtext ──
  subtext: {
    marginTop:  10 * SY,
    fontSize:   13 * SX,
    color:      '#2A3A2A',
    textAlign:  'center',
    lineHeight: 20 * SX,
  },

  // ── Vendor ID chip ──
  vendorIdChip: {
    marginTop:         12 * SY,
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   6 * SY,
    paddingHorizontal: 16 * SX,
    borderRadius:      20,
    backgroundColor:   'rgba(255,255,255,0.20)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.45)',
  },
  vendorIdLabel: {
    fontSize:   12 * SX,
    color:      '#2C1F13',
    fontWeight: '500',
  },
  vendorIdValue: {
    fontSize:   14 * SX,
    fontWeight: '800',
    color:      '#1A5C2E',
    fontFamily: 'IBM Plex Sans',
    letterSpacing: 0.5,
  },

  // ── Steps ──
  stepsWrap: {
    marginTop: 28 * SY,
    width:     W - 50 * SX,
    gap:       10 * SY,
  },
  stepRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10 * SX,
    paddingVertical:   8 * SY,
    paddingHorizontal: 18 * SX,
    borderRadius:      24,
    backgroundColor:   'rgba(255, 255, 255, 0.10)',
    borderWidth:       1,
    borderColor:       'rgba(255, 255, 255, 0.25)',
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.08,
    shadowRadius:      6,
  },
  dot: {
    width:        10 * SX,
    height:       10 * SX,
    borderRadius: 5 * SX,
    backgroundColor: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  dotActive: {
    backgroundColor: '#1A5C2E',
  },
  stepText: {
    fontSize:   13 * SX,
    color:      'rgba(44,31,19,0.5)',
    fontWeight: '500',
    fontFamily: 'IBM Plex Sans',
    flex: 1,
  },
  stepTextActive: {
    color:      '#2C1F13',
    fontWeight: '700',
  },

  // ── Login button ──
  loginBtn: {
    marginTop:       20 * SY,
    marginBottom:    32 * SY,
    width:           240 * SX,
    height:          50 * SY,
    borderRadius:    12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth:     1,
    borderColor:     'rgba(255, 255, 255, 0.4)',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.15,
    shadowRadius:    8,
  },
  loginText: {
    fontSize:   22 * SX,
    fontWeight: '800',
    color:      '#2C1F13',
    fontFamily: 'Poppins',

  },
});
