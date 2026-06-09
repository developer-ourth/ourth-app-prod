import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { LinearGradient } from 'expo-linear-gradient';

const BG_IMAGE = require('../../assets/Frame16.png');

const APP_VERSION = '1.0.0';

export default function GeneralInfoScreen() {
  const router = useRouter();

  function openLink(url: string, fallbackMsg?: string) {
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', fallbackMsg ?? 'Could not open link.'),
    );
  }

  return (
    <ImageBackground source={BG_IMAGE} style={styles.screen} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>General Info</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >

          {/* ── About ── */}
          <View style={styles.section}>
            <LinearGradient colors={['#4A9B5F', '#D8EFE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} pointerEvents="none" />
            <Text style={styles.sectionTitle}>About OURTH</Text>
            <View style={styles.aboutBox}>
              <Text style={styles.aboutText}>
                OURTH is a marketplace connecting vendors and customers for sustainable, everyday products.
                We believe in building a greener future — one order at a time.
              </Text>
            </View>
          </View>

          {/* ── App Info ── */}
          <View style={styles.section}>
            <LinearGradient colors={['#4A9B5F', '#D8EFE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} pointerEvents="none" />
            <Text style={styles.sectionTitle}>App Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>{APP_VERSION}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>Android</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Build</Text>
              <Text style={styles.infoValue}>Stable</Text>
            </View>
          </View>

          {/* ── Legal ── */}
          <View style={styles.section}>
            <LinearGradient colors={['#4A9B5F', '#D8EFE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} pointerEvents="none" />
            <Text style={styles.sectionTitle}>Legal</Text>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => openLink('https://ourth.in/terms', 'Terms of Service page not available.')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Terms of Service</Text>
              <ChevronRight size={16} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => openLink('https://ourth.in/privacy', 'Privacy Policy page not available.')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Privacy Policy</Text>
              <ChevronRight size={16} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.linkRow, { borderBottomWidth: 0 }]}
              onPress={() => openLink('https://ourth.in/refund', 'Refund Policy page not available.')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Refund Policy</Text>
              <ChevronRight size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* ── Social / Website ── */}
          <View style={styles.section}>
            <LinearGradient colors={['#4A9B5F', '#D8EFE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} pointerEvents="none" />
            <Text style={styles.sectionTitle}>Connect</Text>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => openLink('https://ourth.in')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Visit ourth.in</Text>
              <ChevronRight size={16} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.linkRow, { borderBottomWidth: 0 }]}
              onPress={() => openLink('https://instagram.com/ourth.in', 'Instagram not available.')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Follow us on Instagram</Text>
              <ChevronRight size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1 },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  backCircle:  { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 16, paddingBottom: 60, gap: 16 },

  section: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    // elevation: 2,
    borderWidth: 1,
    borderColor: '#1A5C2E',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A5C2E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },

  aboutBox:  { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#2C1F13' },
  aboutText: { fontSize: 14, color: '#2E7D44', lineHeight: 22, marginTop: 10 },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#2C1F13',
    borderBottomWidth: 0,
  },
  infoLabel: { fontSize: 14, color: '#2E7D44' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#2E7D44' },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#2C1F13',
    borderBottomWidth: 0,
  },
  linkLabel: { fontSize: 15, color: '#2E7D44' },
});
