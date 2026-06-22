import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, ChevronLeft } from '@/components/icons';
import { fixAssetUrl } from '@/lib/api';
import { useCollectionsStore } from '@/lib/collectionsStore';
import { useAuthStore } from '@/lib/store';
import type { Product } from '@/lib/types';

const BG_IMAGE = require('../../assets/Frame16.png');
const CARD_W = Math.floor((Dimensions.get('window').width - 36) / 2);

export default function CollectionsScreen() {
  const router = useRouter();
  const { liked, toggle, syncFromApi } = useCollectionsStore();
  const { user } = useAuthStore();
  const isB2B = user?.role === 'vendor';
  const products = Object.values(liked) as Product[];

  useEffect(() => {
    syncFromApi();
  }, []);

  function renderItem({ item }: { item: Product }) {
    const price = isB2B && item.wholesale_price !== null && item.wholesale_price !== undefined
      ? parseFloat(item.wholesale_price)
      : (item.discounted_price
        ? parseFloat(item.discounted_price)
        : parseFloat(item.base_price));
    const rating = item.vendor?.average_rating;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(item.id) } })}
        activeOpacity={0.85}
      >
        <View style={styles.productTop}>
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
          <View style={styles.productFooter}>
            <TouchableOpacity
              onPress={() => toggle(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Heart size={24} color="#0d9488" fill="#0d9488" />
            </TouchableOpacity>
            <Text style={styles.productPrice}>
              ₹{Math.round(price)}
              {isB2B && item.wholesale_price !== null && (
                <Text style={{ fontSize: 8, color: '#0d9488', fontWeight: 'bold' }}> B2B</Text>
              )}
            </Text>
          </View>
          {rating != null && (
            <Text style={styles.productRating}>{rating.toFixed(1)}</Text>
          )}
        </View>
        <View style={styles.productBottom} />
      </TouchableOpacity>
    );
  }

  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>

        <View style={styles.header}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.title}>Collections</Text>
          <Text style={styles.count}>{products.length} item{products.length !== 1 ? 's' : ''}</Text>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Heart size={64} color="#d1d5db" fill="none" />
            <Text style={styles.emptyTitle}>No saved items yet</Text>
            <Text style={styles.emptySubtitle}>Tap the heart on any product to save it here</Text>
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            numColumns={2}
            contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 100, gap: 8 }}
            showsVerticalScrollIndicator={false}
          />
        )}

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title:         { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  count:         { fontSize: 13, color: '#6b7280' },
  emptyWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: '#2C1F13' },
  emptySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },

  productCard: {
    width: CARD_W,
    height: 240,
    margin: 6,
    backgroundColor: 'rgba(247, 233, 198, 0.4)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  productTop:              { marginTop: 6, marginHorizontal: 6, height: 225, backgroundColor: '#EBF2E4', borderRadius: 16, overflow: 'hidden' },
  productBottom:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 2 },
  productImage:            { width: '100%', height: 120, marginTop: 14, backgroundColor: '#EBF2E4' },
  productImagePlaceholder: { width: '100%', height: 120, backgroundColor: '#EBF2E4', alignItems: 'center', justifyContent: 'center' },
  productRating:           { position: 'absolute', top: 8, right: 8, color: '#0d9488', fontWeight: '700', fontSize: 11 },
  productName:             { fontSize: 18, fontWeight: '500', color: '#374151', textAlign: 'center', paddingHorizontal: 8, paddingTop: 5 },
  productFooter:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 18 },
  productPrice:            { color: '#374151', fontSize: 18, fontWeight: '600' },
});
