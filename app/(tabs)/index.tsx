import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, User } from '@/components/icons';
import { BlurView } from 'expo-blur';
import { marketplaceAPI, fixAssetUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useCollectionsStore } from '@/lib/collectionsStore';
import { useCartStore } from '@/lib/cartStore';
import CartSuccessModal from '@/components/ui/CartSuccessModal';
import type { Category, Product } from '@/lib/types';

const BG_IMAGE = require('../../assets/Frame16.png');
const CARD_W = Math.floor((Dimensions.get('window').width - 36) / 2);
const USE_NATIVE_BLUR = Platform.OS !== 'android';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { liked, toggle } = useCollectionsStore();
  const { addItem } = useCartStore();

  const handleAddToCart = useCallback(async (item: Product) => {
    try {
      await addItem(item.id);
      setAddedProductName(item.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not add item.';
      Alert.alert('Error', msg);
    }
  }, [addItem]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCat, setActiveCat]   = useState<number | null>(null);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [addedProductName, setAddedProductName] = useState('');
  const loadCategories = useCallback(async () => {
    try {
      const res = await marketplaceAPI.getCategories();
      setCategories(res.data.data ?? []);
    } catch {}
  }, []);

  const loadProducts = useCallback(async (cat: number | null, pg: number, reset: boolean) => {
    try {
      const res = await marketplaceAPI.getProducts({ category_id: cat ?? undefined, page: pg, per_page: 6 });
      const incoming: Product[] = res.data.data ?? [];
      const meta = res.data.meta;
      setProducts(prev => (reset ? incoming : [...prev, ...incoming]));
      setHasMore(meta ? pg < meta.last_page : false);
    } catch {}
  }, []);

  // Initial load + category change — always resets
  useEffect(() => {
    setPage(1);
    setLoading(true);
    Promise.all([loadCategories(), loadProducts(activeCat, 1, true)]).finally(() =>
      setLoading(false),
    );
  }, [activeCat]);

  // Subsequent page loads (Show more)
  useEffect(() => {
    if (page === 1) return;
    setLoadingMore(true);
    loadProducts(activeCat, page, false).finally(() => setLoadingMore(false));
  }, [page]);

  function toggleLike(item: Product) {
    toggle(item);
  }

  function renderProduct({ item }: { item: Product }) {
    const isLiked = Boolean(liked[item.id]);
    const price   = item.discounted_price
      ? parseFloat(item.discounted_price)
      : parseFloat(item.base_price);
    const rating  = item.vendor?.average_rating;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() =>
          router.push({ pathname: '/product/[id]', params: { id: String(item.id) } })
        }
        activeOpacity={0.85}
      >
        {/* Glassmorphism base */}
        <View style={styles.glassBase}>
          {USE_NATIVE_BLUR ? (
            <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={styles.androidGlassFallback} />
          )}
        </View>
        {/* Green rectangle — inset over yellow card base */}
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
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          {rating != null && (
            <Text style={styles.productRating}>{rating.toFixed(1)}</Text>
          )}
          <Text style={styles.productPrice}>₹{Math.round(price)}</Text>
        </View>
        {/* ADD button — overlaps bottom-right corner */}
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
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.greeting}>Hello!</Text>
              <Text style={styles.userName} numberOfLines={2}>
                {user?.name ?? 'Welcome back'}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.brandName}>Ourth</Text>
              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => router.push('/(tabs)/profile')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <User size={18} color="#1a6b5a" />
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

        {/* Product grid */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0f302d" />
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={item => String(item.id)}
            renderItem={renderProduct}
            numColumns={2}
            contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 100, gap: 8 }}
            showsVerticalScrollIndicator={false}
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
  header:           { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  headerTop:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  greeting:         { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  userName:         { fontSize: 12, color: '#4b5563', marginTop: 2 },
  headerRight:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  brandName:        { fontSize: 16, fontWeight: '700', color: '#0f766e' },
  catItem:          { alignItems: 'center', gap: 4, paddingVertical: 6, marginTop: 12, },
  catEmoji:         { fontSize: 28, opacity: 1 },
  catIcon:          { width: 36, height: 36, opacity: 0.55 },
  catIconActive:    { tintColor: '#1a6b5a', opacity: 1 },
  catLabel:         { fontSize: 16, color: '#4b5563' },
  catLabelActive:   { fontWeight: '700', color: '#111827' },
  loadingWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:        { alignItems: 'center', paddingVertical: 64 },
  emptyText:        { fontSize: 14, color: '#6b7280' },
  showMoreBtn:      { marginHorizontal: 24, marginTop: 16, marginBottom: 8, backgroundColor: '#1a6b5a', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  showMoreText:     { color: '#fff', fontWeight: '600', fontSize: 15 },
  productCard:      {
    width: CARD_W,
    height: 240,
    margin: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    elevation: 4,
    shadowColor: '#ffffff',
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
});
