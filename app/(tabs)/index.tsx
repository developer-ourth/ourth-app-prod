import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Alert,
  Platform,
  TextInput,
  Modal,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, User, Search, Mic, ArrowDown, ArrowUp } from '@/components/icons';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
// Dynamically load expo-av to prevent crash on platforms/devices where native module is missing
let Video: any = null;
let ResizeMode: any = null;
try {
  const ExpoAV = require('expo-av');
  Video = ExpoAV.Video;
  ResizeMode = ExpoAV.ResizeMode;
} catch (e) {
  console.log('expo-av is not available in this environment. Falling back to image banner.');
}
import { marketplaceAPI, fixAssetUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useCollectionsStore } from '@/lib/collectionsStore';
import { useCartStore } from '@/lib/cartStore';
import { useThemeStore } from '@/lib/themeStore';
import { useDebounce } from '@/lib/useDebounce';
import CartSuccessModal from '@/components/ui/CartSuccessModal';
import Skeleton from '@/components/ui/Skeleton';
import Toast from 'react-native-toast-message';
import type { Category, Product } from '@/lib/types';

const BG_IMAGE = require('../../assets/Frame16.png');
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_W = Math.floor((SCREEN_WIDTH - 36) / 2);
const USE_NATIVE_BLUR = Platform.OS !== 'android';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  // Temporarily disabled for now: B2B and B2C use the same rate.
  const isB2B = false; // user?.role === 'vendor';
  const { liked, toggle } = useCollectionsStore();
  const { addItem } = useCartStore();
  const { appBackgroundColor, headerBackgroundColor, appTextColor, bannerTagline, bannerSubtagline, bannerImageUrl, fetchSettings } = useThemeStore();

  const handleAddToCart = useCallback(async (item: Product) => {
    try {
      await addItem(item.id, 1);
      setAddedProductName(item.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not add item.';
      Toast.show({
        type: 'error',
        text1: 'Error adding to cart',
        text2: msg,
      });
    }
  }, [addItem, isB2B]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCat, setActiveCat]   = useState<number | null>(null);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [addedProductName, setAddedProductName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerExpanded, setBannerExpanded] = useState(true);
  const BANNER_HEIGHT = 160;
  const bannerAnim = useRef(new Animated.Value(BANNER_HEIGHT)).current;
  const bannerExpandedRef = useRef(true);
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;

  // Carousel state
  const carouselRef = useRef<FlatList>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Dynamic slides combining backend banner settings with default promotional slides
  const bannerSlides = [
    {
      id: '1',
      tagline: bannerTagline || 'MONSOON Big Sale',
      subtagline: bannerSubtagline || 'DISCOUNT UP TO 40% OFF',
      image: bannerImageUrl || '',
    },
    {
      id: '2',
      tagline: '100% Compostable & Eco-Friendly',
      subtagline: 'Sustainable Dining, Thoughtfully Designed',
      image: '',
    },
    {
      id: '3',
      tagline: 'Bulk Wholesale Orders Available',
      subtagline: 'Direct Factory Rates for B2B & Restaurants',
      image: '',
    },
  ];

  // Auto-scroll Carousel every 3.5 seconds
  useEffect(() => {
    if (!bannerExpanded) return;
    const interval = setInterval(() => {
      setCarouselIndex((prev) => {
        const next = (prev + 1) % bannerSlides.length;
        carouselRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [bannerExpanded, bannerSlides.length]);

  const collapseBanner = () => {
    if (!bannerExpandedRef.current) return;
    bannerExpandedRef.current = false;
    setBannerExpanded(false);
    Animated.timing(bannerAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const expandBanner = () => {
    if (bannerExpandedRef.current) return;
    bannerExpandedRef.current = true;
    setBannerExpanded(true);
    Animated.timing(bannerAnim, {
      toValue: BANNER_HEIGHT,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleProductScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 20 && y > lastScrollY.current) {
      collapseBanner();
    } else if (y <= 5) {
      expandBanner();
    }
    lastScrollY.current = y;
  };

  const [isListening, setIsListening] = useState(false);
  const [listeningText, setListeningText] = useState('Listening...');

  const startVoiceSearch = () => {
    setIsListening(true);
    setListeningText('Listening...');
    setTimeout(() => {
      setListeningText('Processing speech...');
      setTimeout(() => {
        setIsListening(false);
        const query = 'bowl';
        setSearchQuery(query);
        setPage(1);
        loadProducts(activeCat, 1, true, query);
      }, 1200);
    }, 1500);
  };

  const loadCategories = useCallback(async () => {
    try {
      const res = await marketplaceAPI.getCategories();
      setCategories(res.data.data ?? []);
    } catch {}
  }, []);

  const loadProducts = useCallback(async (cat: number | null, pg: number, reset: boolean, search = searchQuery) => {
    try {
      const res = await marketplaceAPI.getProducts({ 
        category_id: cat ?? undefined, 
        page: pg, 
        per_page: 6,
        search: search || undefined
      });
      const incoming: Product[] = res.data.data ?? [];
      const meta = res.data.meta;
      setProducts(prev => (reset ? incoming : [...prev, ...incoming]));
      setHasMore(meta ? pg < meta.last_page : false);
    } catch (error) {
      console.error("Error loading products:", error);
    }
  }, [searchQuery]);

  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  useEffect(() => {
    fetchSettings();
    loadCategories();
  }, []);

  useEffect(() => {
    setPage(1);
    setLoading(true);
    loadProducts(activeCat, 1, true, debouncedSearchQuery).finally(() =>
      setLoading(false),
    );
  }, [activeCat, debouncedSearchQuery]);

  useEffect(() => {
    if (page === 1) return;
    setLoadingMore(true);
    loadProducts(activeCat, page, false, searchQuery).finally(() => setLoadingMore(false));
  }, [page]);

  function toggleLike(item: Product) {
    toggle(item);
  }

  function renderProduct({ item }: { item: Product }) {
    const isLiked = Boolean(liked[item.id]);
    const price   = isB2B && item.wholesale_price !== null && item.wholesale_price !== undefined
      ? parseFloat(item.wholesale_price)
      : (item.discounted_price
        ? parseFloat(item.discounted_price)
        : parseFloat(item.base_price));
    const rating  = item.vendor?.average_rating;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() =>
          router.push({ pathname: '/product/[id]', params: { id: String(item.id) } })
        }
        activeOpacity={0.85}
      >
        <View style={styles.glassBase}>
          {USE_NATIVE_BLUR ? (
            <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={styles.androidGlassFallback} />
          )}
        </View>
        <View style={styles.productTop}>
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={() => toggleLike(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Heart
              size={20}
              color={isLiked ? '#0d9488' : '#9ca3af'}
              fill={isLiked ? '#0d9488' : 'none'}
            />
          </TouchableOpacity>
          {item.primary_image_url ? (
            <Image
              source={{ uri: fixAssetUrl(item.primary_image_url) }}
              style={styles.productImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Text style={{ fontSize: 36 }}>🌿</Text>
            </View>
          )}
          <Text style={[styles.productName, { color: appTextColor }]} numberOfLines={1}>{item.name}</Text>
          {rating != null && (
            <Text style={styles.productRating}>{rating.toFixed(1)}</Text>
          )}
          <Text style={styles.productPrice}>
            ₹{Math.round(price)}
            {isB2B && item.wholesale_price !== null && (
              <Text style={{ fontSize: 8, color: '#1a6b5a', fontWeight: 'bold' }}> B2B</Text>
            )}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.8}
          onPress={(e) => { e.stopPropagation(); handleAddToCart(item); }}
        >
          <Text style={styles.addBtnText}>ADD</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <ImageBackground 
      source={BG_IMAGE} 
      style={[styles.bgWrap, { backgroundColor: appBackgroundColor }]} 
      imageStyle={styles.bgImage}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingTop: 270 + insets.top, paddingHorizontal: 6 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[styles.productCard, { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 }]}>
                <Skeleton width="100%" height="100%" borderRadius={20} />
              </View>
            ))}
          </View>
        ) : (
          <Animated.FlatList
            data={products}
            keyExtractor={(item: Product) => String(item.id)}
            renderItem={renderProduct}
            numColumns={2}
            contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 100, paddingTop: 270 + insets.top }}
            showsVerticalScrollIndicator={false}
            onScroll={handleProductScroll}
            scrollEventThrottle={16}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews={true}
            ListHeaderComponent={
              <Animated.View style={{ height: bannerAnim }} />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            }
            ListFooterComponent={
              hasMore ? (
                <TouchableOpacity
                  onPress={() => setPage(p => p + 1)}
                  disabled={loadingMore}
                  style={styles.showMoreBtn}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.showMoreText}>Show more</Text>
                  )}
                </TouchableOpacity>
              ) : null
            }
          />
        )}

        {/* Solid Background for Status Bar (Notch/Time/Wifi area) */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: headerBackgroundColor, zIndex: 20 }} />

        {/* Unified Top Section Wrapper - Absolutely Positioned */}
        <Animated.View style={[styles.topSectionContainer, { top: insets.top, transform: [{ translateY: headerTranslateY }] }]}>
          {/* Glassmorphism Header */}
          <View style={[styles.glassHeader, !USE_NATIVE_BLUR && { backgroundColor: headerBackgroundColor }]}>
            {USE_NATIVE_BLUR && <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />}
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={{ width: 34 }} />
              <Text style={styles.brandTitleText}>OURTH!</Text>
              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => router.push('/(tabs)/profile')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <User size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={styles.greetingBox}>
              <Text style={styles.greeting}>Hello!</Text>
              <View style={styles.searchContainer}>
                <Search size={18} color="#9ca3af" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchBar}
                  placeholder="Search products..."
                  placeholderTextColor="#9ca3af"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.micBtn}
                  onPress={startVoiceSearch}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Mic size={18} color="#1a6b5a" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Category row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ height: 72, flexShrink: 0 }}
              contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: 6, gap: 16, alignItems: 'center' }}
            >
              {/* All */}
              <TouchableOpacity
                onPress={() => setActiveCat(null)}
                style={styles.catItem}
              >
                <Image
                  source={require('../../assets/14.png')}
                  style={[styles.catIcon, activeCat === null && styles.catIconActive]}
                  resizeMode="contain"
                />
                <Text style={[styles.catLabel, activeCat === null && styles.catLabelActive]}>All</Text>
              </TouchableOpacity>

              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setActiveCat(c.id === activeCat ? null : c.id)}
                  style={styles.catItem}
                >
                  {c.icon_url ? (
                    <Image
                      source={{ uri: fixAssetUrl(c.icon_url) }}
                      style={[styles.catIcon, activeCat === c.id && styles.catIconActive]}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.catEmoji}>🌿</Text>
                  )}
                  <Text style={[styles.catLabel, activeCat === c.id && styles.catLabelActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Collapsible Banner Carousel Section — slides under categories */}
          <Animated.View style={[styles.bannerClip, { height: bannerAnim }]}>
            <FlatList
              ref={carouselRef}
              data={bannerSlides}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCarouselIndex(newIdx);
              }}
              renderItem={({ item }) => {
                const itemIsVideo = item.image ? /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(item.image) : false;
                const resolvedUrl = itemIsVideo ? fixAssetUrl(item.image) : null;

                return (
                  <View style={{ width: SCREEN_WIDTH, height: BANNER_HEIGHT }}>
                    {itemIsVideo && Video ? (
                      <View style={styles.bannerContent}>
                        <Video
                          source={resolvedUrl ? { uri: resolvedUrl } : undefined}
                          style={StyleSheet.absoluteFillObject}
                          resizeMode={ResizeMode?.COVER}
                          shouldPlay
                          isLooping
                          isMuted
                          useNativeControls={false}
                        />
                        <Text style={styles.bannerTagline}>{item.tagline}</Text>
                        <Text style={styles.bannerSubTagline}>{item.subtagline}</Text>
                      </View>
                    ) : (
                      <ImageBackground
                        source={item.image && item.image !== '' ? { uri: fixAssetUrl(item.image) } : BG_IMAGE}
                        style={styles.bannerContent}
                        imageStyle={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                        resizeMode="cover"
                      >
                        <Text style={styles.bannerTagline}>{item.tagline}</Text>
                        <Text style={styles.bannerSubTagline}>{item.subtagline}</Text>
                      </ImageBackground>
                    )}
                  </View>
                );
              }}
            />

            {/* Carousel Dot Indicators */}
            {bannerSlides.length > 1 && (
              <View style={styles.carouselDotsContainer}>
                {bannerSlides.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.carouselDot,
                      carouselIndex === idx && styles.carouselDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        </View>{/* close glassHeader */}
          {/* Curved SVG Toggle Area */}
          <View style={styles.curveContainer}>
            <Svg width="100%" height="40" viewBox="0 0 375 40" preserveAspectRatio="none">
              <Path 
                d="M 112.5 0 C 132.5 0 162.5 30 187.5 30 C 212.5 30 242.5 0 262.5 0 Z" 
                fill={headerBackgroundColor} 
              />
            </Svg>
            <TouchableOpacity
              style={styles.arrowToggleBtn}
              onPress={() => bannerExpandedRef.current ? collapseBanner() : expandBanner()}
              activeOpacity={0.8}
            >
              {bannerExpanded ? (
                <ArrowUp size={20} color="#ffffff" />
              ) : (
                <ArrowDown size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

      <Modal
        visible={isListening}
          transparent
          animationType="fade"
          onRequestClose={() => setIsListening(false)}
        >
          <View style={styles.voiceOverlay}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.voiceCard}>
              <View style={styles.voiceMicCircle}>
                <Mic size={36} color="white" />
              </View>
              <Text style={styles.voiceText}>{listeningText}</Text>
              <Text style={styles.voiceSubtext}>Try saying "bowl" or "plate"</Text>
              <TouchableOpacity 
                style={styles.voiceCloseBtn} 
                onPress={() => setIsListening(false)}
              >
                <Text style={styles.voiceCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <CartSuccessModal
          visible={Boolean(addedProductName)}
          productName={addedProductName}
          onClose={() => setAddedProductName('')}
        />

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgWrap: { flex: 1 },
  bgImage: { opacity: 0.15 },
  topSectionContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    overflow: 'visible',
    zIndex: 10,
  },
  glassHeader: {
    backgroundColor: 'rgba(13,58,39,0.5)',
    overflow: 'hidden',
    zIndex: 2,
    elevation: 2,
  },
  header:           { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  headerTop:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  greetingBox:      { alignItems: 'stretch', marginTop: 12, marginBottom: 8 },
  greeting:         { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  searchContainer:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, marginTop: 8, paddingHorizontal: 12 },
  searchIcon:       { marginRight: 8 },
  searchBar:        { flex: 1, height: 44, fontSize: 15, color: '#1f2937', paddingVertical: 0 },
  micBtn:           { padding: 4, marginLeft: 8 },
  headerRight:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  brandTitleText:   { fontSize: 26, fontWeight: '900', color: '#ffffff', letterSpacing: 1.5 },
  voiceOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  voiceCard:        { width: 280, backgroundColor: 'white', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  voiceMicCircle:   { width: 72, height: 72, borderRadius: 36, backgroundColor: '#154CC5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  voiceText:        { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  voiceSubtext:     { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  voiceCloseBtn:    { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db' },
  voiceCloseText:   { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  catItem:          { alignItems: 'center', gap: 4, paddingVertical: 6, marginTop: 12, },
  catEmoji:         { fontSize: 28, opacity: 1 },
  catIcon:          { width: 36, height: 36, opacity: 0.7, tintColor: '#ffffff' },
  catIconActive:    { tintColor: '#fde047', opacity: 1 },
  catLabel:         { fontSize: 16, color: '#e5e7eb' },
  catLabelActive:   { fontWeight: '700', color: '#ffffff' },
  loadingWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:        { alignItems: 'center', paddingVertical: 64 },
  emptyText:        { fontSize: 14, color: '#6b7280' },
  showMoreBtn:      { marginHorizontal: 24, marginTop: 16, marginBottom: 8, backgroundColor: '#1a6b5a', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  showMoreText:     { color: '#fff', fontWeight: '600', fontSize: 15 },
  productCard:      {
    width: CARD_W,
    height: 240,
    margin: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  glassBase: { ...StyleSheet.absoluteFillObject, borderRadius: 20, overflow: 'hidden' },
  androidGlassFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  productTop:              { marginTop: 6, marginHorizontal: 6, height: 225, backgroundColor: '#EBF2E4', borderRadius: 16, overflow: 'hidden' },
  productBottom:           { paddingHorizontal: 12, paddingTop: 8 },
  productImage:            { width: '100%', height: 150, marginTop: 10, backgroundColor: '#EBF2E4' },
  productImagePlaceholder: { width: '100%', height: 100, backgroundColor: '#EBF2E4', alignItems: 'center', justifyContent: 'center' },
  productRating:           { position: 'absolute', top: 8, right: 8, color: '#0d9488', fontWeight: '700', fontSize: 11 },
  heartBtn:                { position: 'absolute', top: 8, left: 8, zIndex: 1, borderRadius: 20, padding: 5 },
  productName:             { fontSize: 17, fontWeight: '500', color: '#2C1F13', textAlign: 'center', paddingHorizontal: 8, paddingTop: 5 },
  productPrice:            { color: '#0D3A27', fontSize: 16, fontWeight: '600', margin: 10 },
  addBtn:                  { position: 'absolute', bottom: -1, right: -1, backgroundColor: '#F2D48A', borderTopLeftRadius: 14, borderBottomRightRadius: 20, paddingHorizontal: 18, paddingVertical: 9, elevation: 3 },
  addBtnText:              { color: '#0D3A27', fontWeight: '700', fontSize: 14 },
  bannerClip:              { width: '100%', overflow: 'hidden', zIndex: 1, elevation: 1 },
  bannerContent:           { width: '100%', height: 160, justifyContent: 'center', alignItems: 'center' },
  bannerTagline:           { color: '#fde047', fontSize: 22, fontWeight: '800', textAlign: 'center', paddingHorizontal: 16 },
  bannerSubTagline:        { color: '#ffffff', fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 16 },
  carouselDotsContainer:   { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6, zIndex: 10 },
  carouselDot:             { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  carouselDotActive:       { width: 22, backgroundColor: '#fde047' },
  curveContainer:          { width: '100%', height: 40, alignItems: 'center' },
  arrowToggleBtn:          { position: 'absolute', top: 5, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
});
