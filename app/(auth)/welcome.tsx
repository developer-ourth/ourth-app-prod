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
const REGISTER_ICON = require('../../assets/registericon.png');
const LOGIN_ICON    = require('../../assets/loginicon.png');

const { width: W, height: H } = Dimensions.get('window');

// Scale factors from the 360×640 Figma design frame
const SX = W / 360;
const SY = H / 640;

const LOGO = require('../../assets/logo.png');
const BG   = require('../../assets/Login.png');

// Small brown accent positions [left, top] — kept for subtle depth
const BROWN_GLOWS: [number, number][] = [
  [142, 76], [142, 385], [14, 252],
  [267, 166], [164, 554], [321, 516], [314, 90],
];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <ImageBackground source={BG} style={styles.container} resizeMode="cover">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* rgba(44,31,19,0.2) warm dark overlay */}
      <View style={styles.overlay} />

      {/* ── Logo – 145×145, centered, top 55 ── */}
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />

      {/* ── Title – top 225 ── */}
      <Text style={styles.title}>Welcome to{'\'\n'}Healing OURTH</Text>

      {/* ── Subtitle – top 312 ── */}
      <Text style={styles.subtitle}>
        Choose how you'd like to continue your{'\n'}eco-friendly journey
      </Text>

      {/* ── Register card ── */}
      <TouchableOpacity
        style={[styles.card, { top: 386 * SY }]}
        activeOpacity={0.8}
        onPress={() => router.push('/(auth)/register')}
      >
        <View style={styles.iconBox}>
          <Image source={REGISTER_ICON} style={styles.cardIcon} resizeMode="contain" />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Create Account</Text>
          <Text style={styles.cardDesc}>
            New here? Register to start ordering
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── Login card ── */}
      <TouchableOpacity
        style={[styles.card, { top: 502 * SY }]}
        activeOpacity={0.8}
        onPress={() => router.push('/(auth)/login')}
      >
        <View style={styles.iconBox}>
          <Image source={LOGIN_ICON} style={styles.cardIcon} resizeMode="contain" />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardDesc}>
            Already have an account? Sign in to continue
          </Text>
        </View>
      </TouchableOpacity>
    </ImageBackground>
  );
}

const CARD_W  = 291 * SX;
const R38     = 19  * SX;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#1A5C2E',
  },

  // 38×38 small brown accent
  // glow38: {
  //   position: 'absolute',
  //   width:        38 * SX,
  //   height:       38 * SX,
  //   borderRadius: R38,
  //   backgroundColor: '#6B5A3E',
  //   opacity: 0.35,
  // },

  // rgba(44,31,19,0.2) warm dark overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44, 31, 19, 0.2)',
  },

  // Logo – 200×200 centered, top:55
  logo: {
    position: 'absolute',
    width:  180 * SX,
    height: 180 * SX,
    left:   (W - 180 * SX) / 2,
    top:    55  * SY,
  },

  // Title – top:225, #D8EFE0, 700, 28px
  title: {
    position: 'absolute',
    left:      0,
    right:     0,
    top:       225 * SY,
    textAlign: 'center',
    fontWeight: '700',
    fontSize:   28 * SX,
    lineHeight: 36 * SX,
    color:      '#D8EFE0',
    paddingHorizontal: 20,
  },

  // Subtitle – top:312, #F2D48A, 500, 13px
  subtitle: {
    position: 'absolute',
    left:      0,
    right:     0,
    top:       312 * SY,
    textAlign: 'center',
    fontWeight: '500',
    fontSize:   13 * SX,
    lineHeight: 20 * SX,
    color:      '#F2D48A',
    paddingHorizontal: 45 * SX,
  },

  // Card – 291×97, centered, border #EDE8DC, borderRadius 5
  card: {
    position: 'absolute',
    width:    CARD_W,
    height:   97 * SY,
    left:     (W - CARD_W) / 2,
    flexDirection: 'row',
    alignItems:    'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 14 * SX,
    gap: 14 * SX,
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius:  12,
  },

  // Icon box – 60×60, rgba(216,239,224,0.3), borderRadius 15
  iconBox: {
    width:        60 * SX,
    height:       60 * SX,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems:    'center',
    justifyContent:'center',
    flexShrink: 0,
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius:  4,
    elevation: 4,
  },

  cardIcon: {
    width:  40 * SX,
    height: 40 * SX,
  },

  cardText: {
    flex: 1,
  },

  // Card title – #D8EFE0, 16px bold
  cardTitle: {
    fontWeight: '700',
    fontSize:   16 * SX,
    lineHeight: 21 * SX,
    color:      '#D8EFE0',
    marginBottom: 3,
  },

  // Card description – #F2D48A, 12px
  cardDesc: {
    fontWeight: '400',
    fontSize:   12 * SX,
    lineHeight: 18 * SX,
    color:      '#F2D48A',
  },
});
