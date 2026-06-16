import { useState } from 'react';
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

const FAQS = [
  {
    q: 'How do I place an order?',
    a: 'Browse products in the Shop tab, tap a product to view details, then tap "Add to Cart". Once ready, go to your Cart and proceed to checkout.',
  },
  {
    q: 'How do I track my order?',
    a: 'Go to the Orders tab to see all your orders and their current status. You will also receive notifications for any status changes.',
  },
  {
    q: 'How do I cancel an order?',
    a: 'Orders can be cancelled within 1 hour of placement. Go to Orders, tap the order, and select "Cancel". After that window, please contact support.',
  },
  {
    q: 'How do I earn reward points?',
    a: 'You earn points on every purchase. Check the Rewards tab to see your balance and redeem points for discounts or special offers.',
  },
  {
    q: 'How do I save items for later?',
    a: 'Tap the heart icon on any product to save it to your Collections. Find all saved items in the Collections tab.',
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | null>(null);

  function toggle(idx: number) {
    setExpanded((prev) => (prev === idx ? null : idx));
  }

  function openEmail() {
    Linking.openURL('mailto:support@healingourth.com').catch(() =>
      Alert.alert('Error', 'Could not open email client.'),
    );
  }

  function openPhone() {
    Linking.openURL('tel:+919999999999').catch(() =>
      Alert.alert('Error', 'Could not open phone dialer.'),
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
          <Text style={styles.topBarTitle}>Help &amp; Support</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >

          {/* ── FAQ ── */}
          <View style={styles.section}>
            <LinearGradient colors={['#4A9B5F', '#D8EFE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} pointerEvents="none" />
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            {FAQS.map((item, idx) => (
              <View key={idx} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => toggle(idx)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faqQuestionText}>{item.q}</Text>
                  <ChevronRight
                    size={16}
                    color="#9ca3af"
                    style={{ transform: [{ rotate: expanded === idx ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
                {expanded === idx && (
                  <Text style={styles.faqAnswer}>{item.a}</Text>
                )}
              </View>
            ))}
          </View>

          {/* ── Contact Us ── */}
          <View style={styles.section}>
            <LinearGradient colors={['#4A9B5F', '#D8EFE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} pointerEvents="none" />
            <Text style={styles.sectionTitle}>Contact Us</Text>
            <TouchableOpacity style={styles.contactRow} onPress={openEmail} activeOpacity={0.7}>
              <View>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactDetail}>support@healingourth.com</Text>
              </View>
              <ChevronRight size={16} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactRow} onPress={openPhone} activeOpacity={0.7}>
              <View>
                <Text style={styles.contactLabel}>Phone Support</Text>
                <Text style={styles.contactDetail}>+91 99999 99999 (Mon–Sat, 9am–6pm)</Text>
              </View>
              <ChevronRight size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* ── Report issue ── */}
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => Alert.alert('Report Submitted', 'Thank you — our team will get back to you within 24 hours.')}
            activeOpacity={0.8}
          >
            <Text style={styles.reportBtnText}>Report an Issue</Text>
          </TouchableOpacity>

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
    fontWeight: '800',
    color: '#1A5C2E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },

  faqItem: { borderTopWidth: 1, borderTopColor: '#2C1F13' },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  faqQuestionText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#2E7D44' },
  faqAnswer: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#2C1F13',
  },
  contactLabel:  { fontSize: 14, fontWeight: '800', color: '#1A5C2E' },
  contactDetail: { fontSize: 12, color: '#1A5C2E', marginTop: 2 },

  reportBtn: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#6EC9D8',
  },
  reportBtnText: { fontSize: 15, fontWeight: '600', color: '#1a6b5a' },
});
