import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, ImageBackground, StyleSheet, Dimensions, Animated, Alert, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Heart, ShoppingCart } from '@/components/icons';
import BottomTabBar from '@/components/ui/BottomTabBar';
import CartSuccessModal from '@/components/ui/CartSuccessModal';
import { marketplaceAPI, fixAssetUrl } from '@/lib/api';
import { useCartStore } from '@/lib/cartStore';
import { useCollectionsStore } from '@/lib/collectionsStore';
import type { Product } from '@/lib/types';

const BG_IMAGE = require('../../assets/Frame16.png');
const { width: W, height: H } = Dimensions.get('window');
const CARD_W = Math.floor((W - 48) / 3);
const HERO_FRAME_W = W * 0.78;

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [addedProductName, setAddedProductName] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);

  const { liked: likedMap, toggle } = useCollectionsStore();
  const isLiked = product ? Boolean(likedMap[product.id]) : false;

  const { addItem, addingProductId } = useCartStore();
  const isAddingToCart = product ? addingProductId === product.id : false;
  const insets = useSafeAreaInsets();

  const selectedPack = product?.packs?.find(p => p.id === selectedPackId);

  useEffect(() => {
    if (product && product.packs && product.packs.length > 0) {
      const activePacks = product.packs.filter(p => p.is_active);
      if (activePacks.length > 0) {
        setSelectedPackId(activePacks[0].id);
      }
    }
  }, [product]);

  const handleAddToCart = useCallback(async () => {
    if (!product) { return; }
    try {
      await addItem(product.id, 1, selectedPackId);
      setAddedProductName(selectedPack ? `${product.name} (${selectedPack.name})` : product.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not add item.';
      Alert.alert('Error', msg);
    }
  }, [product, addItem, selectedPackId, selectedPack]);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Image shrinks via scale — runs on native thread (smooth)
  const imageScale = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [1, 0.5],
    extrapolate: 'clamp',
  });

  // More Items fades + slides up after 80px scroll
  const moreOpacity = scrollY.interpolate({
    inputRange: [60, 180],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const moreTranslateY = scrollY.interpolate({
    inputRange: [60, 180],
    outputRange: [28, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await marketplaceAPI.getProduct(Number(id));
        const prod: Product = res.data.data ?? res.data;
        setProduct(prod);

        const related = await marketplaceAPI.getProducts({ category_id: prod.category_id ?? undefined, per_page: 6 });
        const items: Product[] = related.data.data ?? related.data;
        setRelatedProducts(items.filter((p: Product) => p.id !== prod.id));
      } catch {
        setError('Failed to load product.');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <ImageBackground source={BG_IMAGE} style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color="#1a6b5a" />
      </ImageBackground>
    );
  }

  if (error || !product) {
    return (
      <ImageBackground source={BG_IMAGE} style={[styles.screen, styles.center]}>
        <Text style={styles.errorText}>{error || 'Product not found.'}</Text>
        <TouchableOpacity style={styles.errorBtn} onPress={() => router.back()}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </ImageBackground>
    );
  }

  const imageUri = product.primary_image_url
    ? fixAssetUrl(product.primary_image_url)
    : null;

  const price = selectedPack 
    ? (selectedPack.discounted_price ?? selectedPack.base_price) 
    : (product.discounted_price ?? product.base_price ?? 0);
  const imageUrls = Array.from(
    new Set(
      [product.primary_image_url, ...(product.secondary_images ?? [])]
        .filter((url): url is string => Boolean(url && url.trim()))
        .map((url) => fixAssetUrl(url)),
    ),
  );

  return (
    <ImageBackground source={BG_IMAGE} style={styles.screen} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header — fixed */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.productTitle} numberOfLines={1}>{product.name}</Text>
          <TouchableOpacity onPress={() => product && toggle(product)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Heart size={24} color={isLiked ? '#0d9488' : '#9ca3af'} fill={isLiked ? '#0d9488' : 'none'} />
          </TouchableOpacity>
        </View>

        <View style={styles.contentWrap}>
          {/* Hero image stays fixed; only scale changes with scroll */}
          <View style={styles.imageArea}>
            <Animated.View style={{ transform: [{ scale: imageScale }], width: HERO_FRAME_W, height: '100%' }}>
              {imageUrls.length > 0 ? (
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    bounces={false}
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(event) => {
                      const offsetX = event.nativeEvent.contentOffset.x;
                      const nextIndex = Math.round(offsetX / HERO_FRAME_W);
                      setActiveImageIndex(nextIndex);
                    }}
                    style={styles.heroCarousel}
                    contentContainerStyle={styles.heroCarouselContent}
                  >
                    {imageUrls.map((uri, index) => (
                      <View key={`${uri}-${index}`} style={styles.heroSlide}>
                        <Image source={{ uri }} style={styles.heroImage} resizeMode="contain" />
                      </View>
                    ))}
                  </ScrollView>

                  {imageUrls.length > 1 && (
                    <View style={styles.paginationRow}>
                      {imageUrls.map((_, index) => (
                        <View
                          key={`dot-${index}`}
                          style={[styles.paginationDot, index === activeImageIndex && styles.paginationDotActive]}
                        />
                      ))}
                    </View>
                  )}
                </>
              ) : imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="contain" />
              ) : (
                <Text style={{ fontSize: 64, textAlign: 'center' }}>🌿</Text>
              )}
            </Animated.View>
          </View>

          {/* Scrollable content overlays image area when scrolling up */}
          <Animated.ScrollView
            style={styles.detailsScroll}
            contentContainerStyle={[styles.detailsScrollContent, { paddingBottom: 220 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
            scrollEventThrottle={16}
          >
            {/* Pack Size Selector */}
            {product.packs && product.packs.length > 0 && (
              <View style={styles.packsCard}>
                <Text style={styles.detailsHeading}>Select Pack Size</Text>
                <View style={styles.packsRow}>
                  {product.packs.map((pack) => {
                    const isSelected = pack.id === selectedPackId;
                    const packPrice = pack.discounted_price ?? pack.base_price;
                    return (
                      <TouchableOpacity
                        key={pack.id}
                        style={[
                          styles.packOption,
                          isSelected && styles.packOptionSelected
                        ]}
                        onPress={() => setSelectedPackId(pack.id)}
                      >
                        <Text style={[styles.packName, isSelected && styles.packNameSelected]}>
                          {pack.name}
                        </Text>
                        <Text style={[styles.packPriceText, isSelected && styles.packPriceTextSelected]}>
                          ₹{packPrice}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Details */}
            <View style={styles.detailsCard}>
            <Text style={styles.detailsHeading}>Details</Text>
            <Text style={styles.detailsBody}>
              {product.description ?? 'No description available.'}
            </Text>
            </View>

            {/* More Items — hidden until scroll threshold */}
            {relatedProducts.length > 0 && (
              <Animated.View
                style={[
                  styles.moreSection,
                  { opacity: moreOpacity, transform: [{ translateY: moreTranslateY }] },
                ]}
              >
                <Text style={styles.moreSectionTitle}>More Items</Text>
                <View style={styles.moreGrid}>
                  {relatedProducts.map((item) => {
                    const uri = item.primary_image_url ? fixAssetUrl(item.primary_image_url) : null;
                    const itemPrice = item.discounted_price ?? item.base_price ?? 0;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.moreCard}
                        onPress={() => router.push(`/product/${item.id}`)}
                      >
                        <View style={styles.moreCardTop}>
                          {uri ? (
                            <Image source={{ uri }} style={styles.moreCardImage} resizeMode="contain" />
                          ) : (
                            <Text style={{ fontSize: 28, textAlign: 'center' }}>🌿</Text>
                          )}
                          <Text style={styles.ratingBadge}>
                            {item.vendor?.average_rating ?? '–'}
                          </Text>
                        </View>
                        <View style={styles.moreCardBottom}>
                          <Text style={styles.moreCardName} numberOfLines={1}>{item.name}</Text>
                          <View style={styles.moreCardFooter}>
                            <Heart size={12} color="#9ca3af" fill="none" />
                            <Text style={styles.moreCardPrice}>₹{itemPrice}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            )}
          </Animated.ScrollView>
        </View>

        {/* Bottom action bar + tab bar — pinned to screen bottom */}
        <View style={styles.bottomContainer}>
          <View style={styles.bottomBar}>
          <View style={styles.pricePill}>
            <Text style={styles.bottomPrice}>₹{price}</Text>
          </View>
          <TouchableOpacity
            style={[styles.addToCartBtn, isAddingToCart && styles.addToCartBtnDisabled]}
            onPress={handleAddToCart}
            disabled={isAddingToCart}
          >
            {isAddingToCart ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <ShoppingCart size={18} color="#fff" />
                <Text style={styles.addToCartText}>Add to Cart</Text>
              </>
            )}
          </TouchableOpacity>
          </View>

          <BottomTabBar activeTab="index" />
        </View>

        <CartSuccessModal
          visible={Boolean(addedProductName)}
          productName={addedProductName}
          onClose={() => setAddedProductName('')}
        />

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:    { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  errorBtn:     { backgroundColor: '#1a6b5a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  errorBtnText: { color: '#fff', fontWeight: '600' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productTitle: { fontSize: 20, fontWeight: '700', color: '#2C1F13', flex: 1, paddingTop: 40 },

  contentWrap: {
    flex: 1,
  },
  imageArea: {
    height: H * 0.36,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    overflow: 'hidden',
  },
  detailsScroll: { flex: 1 },
  // Keep content naturally below the hero image.
  detailsScrollContent: { paddingTop: 28 },
  heroCarousel: { flex: 1 },
  heroCarouselContent: { alignItems: 'stretch' },
  heroSlide: { width: HERO_FRAME_W, height: '100%', alignItems: 'center', justifyContent: 'center' },
  heroImage: { width: '100%', height: '100%', marginTop: 16 },
  paginationRow: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(16, 94, 65, 0.22)',
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#105e41',
  },

  detailsCard: {
    marginHorizontal: 16,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 16,
  },
  detailsHeading: { fontSize: 24, fontWeight: '700', color: '#2C1F13', marginBottom: 8 },
  detailsBody:    { fontSize: 16, color: '#4A3728', lineHeight: 22 },

  moreSection: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  moreSectionTitle: { fontSize: 20, fontWeight: '700', color: '#2C1F13', marginBottom: 12 },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moreCard: {
    width: CARD_W,
    backgroundColor: 'rgba(247,233,198,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    overflow: 'hidden',
  },
  moreCardTop: {
    height: CARD_W * 0.95,
    backgroundColor: '#EBF2E4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    position: 'relative',
  },
  moreCardImage: { width: '100%', height: '100%' },
  ratingBadge: {
    position: 'absolute',
    top: 5,
    right: 6,
    fontSize: 10,
    fontWeight: '700',
    color: '#2C1F13',
  },
  moreCardBottom: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 },
  moreCardName:  { fontSize: 11, fontWeight: '600', color: '#2C1F13', marginBottom: 4 },
  moreCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreCardPrice: { fontSize: 11, fontWeight: '700', color: '#2C1F13' },

  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 0,
    paddingHorizontal: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(233, 243, 228, 0.97)',
    borderWidth: 1,
    borderColor: 'rgba(16, 94, 65, 0.12)',
    borderRadius: 12,
    shadowColor: '#0f5132',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  pricePill: {
    
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bottomPrice:   { fontSize: 30, fontWeight: '800', color: '#105e41' },
  addToCartBtn:  { backgroundColor: '#4A9B5F', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addToCartBtnDisabled: { opacity: 0.6 },
  addToCartText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  packsCard: {
    marginHorizontal: 16,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 8,
  },
  packsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  packOption: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 100,
  },
  packOptionSelected: {
    backgroundColor: '#105e41',
    borderColor: '#105e41',
  },
  packName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C1F13',
  },
  packNameSelected: {
    color: '#fff',
  },
  packPriceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 2,
  },
  packPriceTextSelected: {
    color: '#fff',
  },
});

