import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

// Asset map
const MASCOT   = require('../../assets/Ourth.png');
const CHEVRON  = require('../../assets/front.png');
const BIRD     = require('../../assets/43.png');
const TREE      = require('../../assets/36.png');
const TREE_RIGHT = require('../../assets/37.png');
const FLOWERS1 = require('../../assets/39.png');   // daisy foreground
const FLOWERS2 = require('../../assets/38.png');   // tulip foreground
const CLOUD    = require('../../assets/40.png');
const GROUND35 = require('../../assets/35.png');   // darkest - layer 1 (back)
const GROUND34 = require('../../assets/34.png');   // bumpy hills - layer 2
const GROUND33 = require('../../assets/33.png'); 
const GROUND32 = require('../../assets/32.png');   // slanted hill - layer 3
const GROUND31 = require('../../assets/31.png');   // light hill - layer 4 (front)

export default function LandingScreen() {
  const router = useRouter();

  // Animated values
  const titleOpacity   = useRef(new Animated.Value(0)).current;
  const titleY         = useRef(new Animated.Value(-30)).current;
  const mascotOpacity  = useRef(new Animated.Value(0)).current;
  const mascotY        = useRef(new Animated.Value(80)).current;
  const birdX          = useRef(new Animated.Value(-100)).current;
  const birdOpacity    = useRef(new Animated.Value(0)).current;
  const cloud1X        = useRef(new Animated.Value(-160)).current;
  const cloud2X        = useRef(new Animated.Value(W)).current;
  const btnOpacity     = useRef(new Animated.Value(0)).current;
  const btnScale       = useRef(new Animated.Value(0.85)).current;

  // Idle bounce for mascot
  const mascotBounce   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance sequence
    Animated.sequence([
      // 1. Clouds drift in
      Animated.parallel([
        Animated.timing(cloud1X, { toValue: -20, duration: 900, useNativeDriver: true }),
        Animated.timing(cloud2X, { toValue: W - 180, duration: 900, useNativeDriver: true }),
      ]),
      // 2. Title fades down
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      // 3. Bird flies in from right
      Animated.parallel([
        Animated.timing(birdX, { toValue: W * 0.62, duration: 700, useNativeDriver: true }),
        Animated.timing(birdOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      // 4. Mascot bounces up
      Animated.parallel([
        Animated.spring(mascotY, { toValue: 0, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.timing(mascotOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      // 5. Button appears
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(btnScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Idle mascot float loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(mascotBounce, { toValue: -10, duration: 1200, useNativeDriver: true }),
          Animated.timing(mascotBounce, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
      ).start();
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Sky gradient background (solid sky blue) */}
      <View style={styles.sky} />

      {/* Ground layers: 31 (back/tallest) → 32 → 34 → 35 (front/bottom strip) */}
      <Image source={GROUND31} style={styles.ground31} resizeMode="stretch" />
      <Image source={GROUND32} style={styles.ground32} resizeMode="stretch" />
      <Image source={GROUND33} style={styles.ground33} resizeMode="stretch" />
      <Image source={GROUND34} style={styles.ground34} resizeMode="contain" />
      <Image source={GROUND35} style={styles.ground35} resizeMode="stretch" />

      {/* Clouds */}
      <Animated.Image
        source={CLOUD}
        style={[styles.cloud, styles.cloud1, { transform: [{ translateX: cloud1X }] }]}
        resizeMode="contain"
      />
      <Animated.Image
        source={CLOUD}
        style={[styles.cloud, styles.cloud2, { transform: [{ translateX: cloud2X }] }]}
        resizeMode="contain"
      />

      {/* Trees */}
      <Image source={TREE} style={styles.treeLeft}  resizeMode="contain" />
      <Image source={TREE_RIGHT} style={styles.treeRight} resizeMode="contain" />

      {/* Bird */}
      <Animated.Image
        source={BIRD}
        style={[
          styles.bird,
          { opacity: birdOpacity, transform: [{ translateX: birdX }] },
        ]}
        resizeMode="contain"
      />

      {/* Title block */}
      <Animated.View
        style={[
          styles.titleBlock,
          { opacity: titleOpacity, transform: [{ translateY: titleY }] },
        ]}
      >
        <Text style={styles.heading}>
          Healing{' '}
          <Text style={styles.headingBrand}>Ourth</Text>
        </Text>
        <Text style={styles.subheading}>ECO-FRIENDLY DISPOSABLES</Text>
      </Animated.View>

      {/* Mascot */}
      <Animated.Image
        source={MASCOT}
        style={[
          styles.mascot,
          {
            opacity: mascotOpacity,
            transform: [
              { translateY: mascotY },
              { translateY: mascotBounce },
            ],
          },
        ]}
        resizeMode="contain"
      />

      {/* Foreground flowers (on top of ground layers) */}
      <Image source={FLOWERS2} style={styles.flowersLeft}  resizeMode="contain" />
      <Image source={FLOWERS1} style={styles.flowersRight} resizeMode="contain" />

      {/* Get Started button */}
      <Animated.View
        style={[
          styles.btnWrapper,
          { opacity: btnOpacity, transform: [{ scale: btnScale }] },
        ]}
      >
        <TouchableOpacity
          style={styles.btn}
          activeOpacity={0.85}
          onPress={() => router.push('/(auth)/welcome')}
        >
          <LinearGradient
            colors={['#1A5C2E', '#B8DEC4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            <Text style={styles.btnText}>Get Started</Text>
            <Image source={CHEVRON} style={styles.btnChevron} resizeMode="contain" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#87CEEB',
    overflow: 'hidden',
  },
  sky: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#87CEEB',
  },

  // Ground layers — all anchored bottom:0, z-order 31(back)→35(front)
  // Heights decrease front→back so each background layer peeks above the one in front
  ground31: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: W,
    height: H * 0.50,  // tallest — background hills visible highest on screen
  },
  ground32: {
    position: 'absolute',
    bottom: H * 0.25,
    left: 0,
    width: W,
    height: H * 0.20,
  },
   ground33: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: W,
    height: H * 0.50,
  },
  ground34: {
    position: 'absolute',
    bottom: -40,
    left: 0,
    width: W,
    height: H * 0.50,
  },
  ground35: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: W,
    height: H * 0.2,  // shortest — dark strip at very bottom of screen
  },

  // Clouds
  cloud: {
    position: 'absolute',
    width: 300,
    height: 140,
    opacity: 0.9,
  },
  cloud1: { top: H * 0.08 },
  cloud2: { top: H * 0.14, width: 150, height: 70 },

  // Trees (sit on the mid-ground layers)
  treeLeft: {
    position: 'absolute',
    width: 400,
    height: 400,
    bottom: H * 0.35,
    left: -150,
  },
  treeRight: {
    position: 'absolute',
    width: 400,
    height: 300,
    bottom: H * 0.28,
    right: -100,
  },

  // Bird
  bird: {
    position: 'absolute',
    width: 80,
    height: 80,
    top: H * 0.28,
    left: -150,

  },

  // Title
  titleBlock: {
    position: 'absolute',
    top: H * 0.07,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1a3c1a',
    letterSpacing: 0.5,
  },
  headingBrand: {
    fontSize: 34,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#16a34a',
  },
  subheading: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2.5,
    color: '#2d5a2d',
  },

  // Mascot (feet rest on front ground layer)
  mascot: {
    position: 'absolute',
    width: W * 1,
    height: W * 1,
    bottom: H * 0.20,
    alignSelf: 'center',
    left: (W - W * 1) / 2,
  },

  // Foreground flowers
  flowersLeft: {
    position: 'absolute',
    width: 220,
    height: 100,
    bottom: -5,
    left: -10,
  },
  flowersRight: {
    position: 'absolute',
    width: 220,
    height: 100,
    bottom: -10,
    right: -10,
  },

  // Button
  btnWrapper: {
    position: 'absolute',
    bottom: H * 0.08,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  btn: {
    borderRadius: 10,
    overflow: 'hidden',
    borderColor: '#EDE8DC',
    borderWidth: 1,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 12,
    gap: 12,
  },
  btnText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#D8EFE0',
    letterSpacing: 0.8,
    fontFamily: 'Playfair Display',
  },
  btnChevron: {
    width: 18,
    height: 18,
    tintColor: '#fff',
  },
});
