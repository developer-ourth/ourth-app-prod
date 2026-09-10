import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ImageBackground,
  Dimensions,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY, VENDOR_ID_KEY } from '@/lib/api';

const { width: W, height: H } = Dimensions.get('window');
const SX = W / 360;
const SY = H / 640;

const BG = require('../../assets/Registers.png');

export default function CompleteProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ identifier?: string; type?: 'phone' | 'email' }>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState(params.type === 'email' ? params.identifier || '' : '');
  const [phone, setPhone] = useState(params.type === 'phone' ? params.identifier || '' : '');
  
  const [userType, setUserType] = useState<'hawker' | 'business'>('hawker');
  const isBusiness = userType === 'business';
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');

  const [loading, setLoading] = useState(false);

  async function handleCompleteProfile() {
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter your name.');
      return;
    }
    if (isBusiness) {
      if (!businessName.trim()) {
        Alert.alert('Validation', 'Please enter your business name.');
        return;
      }
      if (!gstin.trim()) {
        Alert.alert('Validation', 'GSTIN number is compulsory for business registration.');
        return;
      }
    }

    setLoading(true);
    try {
      // Generate a secure random password for OTP signups
      const securePassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) + 'A1!';

      const payload = {
        name,
        email,
        phone,
        password: securePassword,
        password_confirmation: securePassword,
        role: isBusiness ? 'vendor' : 'consumer',
        ...(isBusiness && { business_name: businessName, gstin: gstin.trim().toUpperCase() }),
      };

      const { data } = await api.post('/auth/register', payload);

      await SecureStore.setItemAsync(TOKEN_KEY, data.data.token);
      if (data.data.user.vendor_id) {
        await SecureStore.setItemAsync(VENDOR_ID_KEY, String(data.data.user.vendor_id));
      }
      
      useAuthStore.setState({ token: data.data.token, user: data.data.user, isLoading: false });
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.message || err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground source={BG} style={styles.container} resizeMode="cover">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.formWrap, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom + 20, 32) }]} keyboardShouldPersistTaps="handled">
          
          <Text style={styles.headerTitle}>Complete Profile</Text>
          <Text style={styles.subtitle}>Tell us a bit more about yourself to finish signing up.</Text>

          {/* Account Type Selection */}
          <Text style={styles.label}>Account Type</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, marginTop: 4 }}>
            <TouchableOpacity
              style={[
                styles.input,
                { flex: 1, alignItems: 'center', justifyContent: 'center' },
                !isBusiness && { backgroundColor: '#1A5C2E', borderColor: '#1A5C2E' },
              ]}
              onPress={() => setUserType('hawker')}
              activeOpacity={0.8}
            >
              <Text style={[{ fontSize: 16 * SX, fontWeight: '700', color: '#1A5C2E' }, !isBusiness && { color: '#ffffff' }]}>Hawker</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.input,
                { flex: 1, alignItems: 'center', justifyContent: 'center' },
                isBusiness && { backgroundColor: '#1A5C2E', borderColor: '#1A5C2E' },
              ]}
              onPress={() => setUserType('business')}
              activeOpacity={0.8}
            >
              <Text style={[{ fontSize: 16 * SX, fontWeight: '700', color: '#1A5C2E' }, isBusiness && { color: '#ffffff' }]}>Business</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor="rgba(60,80,60,0.6)" />

          <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="rgba(60,80,60,0.6)" keyboardType="email-address" autoCapitalize="none" />

          <Text style={[styles.label, { marginTop: 16 }]}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+919876543210" placeholderTextColor="rgba(60,80,60,0.6)" keyboardType="phone-pad" />

          {isBusiness && (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>Business Name *</Text>
              <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Acme Corp" placeholderTextColor="rgba(60,80,60,0.6)" />

              <Text style={[styles.label, { marginTop: 16 }]}>GSTIN Number *</Text>
              <TextInput style={styles.input} value={gstin} onChangeText={(t) => setGstin(t.toUpperCase())} placeholder="22AAAAA0000A1Z5" placeholderTextColor="rgba(60,80,60,0.6)" autoCapitalize="characters" maxLength={15} />
            </>
          )}

          <TouchableOpacity style={[styles.proceedBtn, loading && styles.disabledBtn]} onPress={handleCompleteProfile} disabled={loading}>
            {loading ? <ActivityIndicator color="#1A5C2E" /> : <Text style={styles.proceedText}>Create Account</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#7DDCE8' },
  formWrap: { paddingHorizontal: 22 * SX },
  headerTitle: { fontSize: 32 * SX, fontWeight: '700', color: '#1A5C2E', marginBottom: 8 },
  subtitle: { fontSize: 16 * SX, color: '#1A5C2E', marginBottom: 24, opacity: 0.8 },
  
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#1A5C2E' },
  toggleLabel: { fontSize: 16 * SX, fontWeight: '700', color: '#1A5C2E' },

  label: { fontSize: 16 * SX, fontWeight: '700', color: '#1A5C2E', marginBottom: 6 * SY, paddingLeft: 8 * SX },
  input: { height: 46, borderRadius: 10, paddingHorizontal: 14 * SX, fontSize: 16 * SX, fontWeight: '600', color: '#1A5C2E', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderWidth: 1, borderColor: '#1A5C2E' },
  
  proceedBtn: { height: 50, width: '100%', borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: '#1A5C2E', alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  disabledBtn: { opacity: 0.6 },
  proceedText: { fontSize: 18 * SX, fontWeight: '700', color: '#1A5C2E' },
});
