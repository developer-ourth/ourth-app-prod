import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, User } from '@/components/icons';
import api, { fixAssetUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

let DocumentPicker: any = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  console.warn('DocumentPicker not loaded');
}

let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('ImagePicker not loaded');
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BG_IMAGE = require('../../assets/Frame16.png');

interface KycDocument {
  id: number;
  document_type: string;
  document_url: string;
  status: 'submitted' | 'verified' | 'rejected';
  created_at: string;
}

const DOC_TYPES = [
  { value: 'gst_certificate', label: 'GST Certificate' },
  { value: 'trade_license', label: 'Trade License' },
  { value: 'pan_card', label: 'PAN Card' },
  { value: 'aadhar', label: 'Aadhar Card' },
  { value: 'bank_statement', label: 'Bank Statement' },
];

export default function KycScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<any>(null);
  const [docType, setDocType] = useState('gst_certificate');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchVendorKycStatus();
  }, []);

  async function fetchVendorKycStatus() {
    if (!user || !user.vendor_id) return;
    try {
      const { data } = await api.get(`/dashboard/vendor/${user.vendor_id}`);
      setVendorData(data);
    } catch (err) {
      console.log('Error loading KYC details', err);
    } finally {
      setLoading(false);
    }
  }

  const handlePickDocument = async () => {
    if (!DocumentPicker) {
      Alert.alert(
        'App Rebuild Needed',
        'Document picking requires the app to be rebuilt with the new native libraries. Please stop and run "npm run android" in the terminal to rebuild the app.'
      );
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document.');
    }
  };

  const handlePickImage = async () => {
    if (!ImagePicker) {
      Alert.alert(
        'App Rebuild Needed',
        'Image picking requires the app to be rebuilt with the new native libraries. Please stop and run "npm run android" in the terminal to rebuild the app.'
      );
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please grant library permissions to upload documents.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const uriParts = asset.uri.split('/');
        const fileName = uriParts[uriParts.length - 1];
        setSelectedFile({
          uri: asset.uri,
          name: fileName,
          type: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handleSubmit = async () => {
    if (!user || !user.vendor_id) return;
    if (!selectedFile) {
      Alert.alert('Validation', 'Please select a document file first.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('vendor_id', String(user.vendor_id));
      formData.append('document_type', docType);
      
      // Construct file details for React Native fetch
      formData.append('document', {
        uri: Platform.OS === 'ios' ? selectedFile.uri.replace('file://', '') : selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.type,
      } as any);

      await api.post('/vendors/kyc/upload-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', 'Document uploaded and submitted successfully.');
      setSelectedFile(null);
      fetchVendorKycStatus();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const vendor = vendorData?.vendor || {};
  const kycStatus = String(vendor.kyc_status || 'pending').toLowerCase();
  const docs = (vendor.kyc_documents || []) as KycDocument[];

  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Business KYC</Text>
          <View style={{ width: 38 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1a6b5a" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Status Summary Banner */}
            <View style={styles.statusSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.statusIndicatorCircle, 
                  kycStatus === 'verified' || kycStatus === 'approved' ? { backgroundColor: '#10b981' } : 
                  kycStatus === 'rejected' ? { backgroundColor: '#ef4444' } : { backgroundColor: '#f59e0b' }
                ]} />
                <View>
                  <Text style={styles.statusTitle}>
                    KYC Status: {kycStatus.toUpperCase()}
                  </Text>
                  <Text style={styles.statusDesc}>
                    {kycStatus === 'verified' || kycStatus === 'approved' ? 'Wholesale catalog unlocked' : 
                     kycStatus === 'rejected' ? 'Verification rejected. Please re-upload documents.' : 
                     'Awaiting document review'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Document Upload Form */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Submit New Document</Text>
              
              {/* Custom Selector for Document Type */}
              <Text style={styles.fieldLabel}>Select Document Type</Text>
              <View style={styles.docTypeContainer}>
                {DOC_TYPES.map((type) => {
                  const isActive = docType === type.value;
                  return (
                    <TouchableOpacity
                      key={type.value}
                      style={[styles.docTypeBadge, isActive && styles.docTypeBadgeActive]}
                      onPress={() => setDocType(type.value)}
                    >
                      <Text style={[styles.docTypeBadgeText, isActive && styles.docTypeBadgeTextActive]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* File selection controls */}
              <Text style={styles.fieldLabel}>Choose Document File</Text>
              <View style={styles.pickerRow}>
                <TouchableOpacity style={styles.pickerBtn} onPress={handlePickImage}>
                  <Text style={styles.pickerBtnText}>📸 Select Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerBtn} onPress={handlePickDocument}>
                  <Text style={styles.pickerBtnText}>📄 Select PDF</Text>
                </TouchableOpacity>
              </View>

              {selectedFile && (
                <View style={styles.filePreviewCard}>
                  <Text style={styles.filePreviewTitle} numberOfLines={1}>
                    Selected: {selectedFile.name}
                  </Text>
                  <Text style={styles.filePreviewSub}>
                    Type: {selectedFile.type}
                  </Text>
                </View>
              )}

              <TouchableOpacity 
                style={[styles.submitBtn, !selectedFile && styles.submitBtnDisabled]} 
                onPress={handleSubmit}
                disabled={uploading || !selectedFile}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Document</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Submitted Documents List */}
            {docs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Submitted Documents</Text>
                {docs.map((doc) => (
                  <View key={doc.id} style={styles.docRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docRowTitle}>
                        {DOC_TYPES.find((t) => t.value === doc.document_type)?.label || doc.document_type}
                      </Text>
                      <Text style={styles.docRowSub}>
                        Submitted: {new Date(doc.created_at).toLocaleDateString('en-IN')}
                      </Text>
                    </View>
                    <View style={styles.docRowRight}>
                      <View style={[styles.badge, 
                        doc.status === 'verified' ? styles.badgeSuccess : 
                        doc.status === 'rejected' ? styles.badgeError : styles.badgeWarning
                      ]}>
                        <Text style={styles.badgeText}>{doc.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

          </ScrollView>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#2C1F13' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  
  statusSection: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16,
    padding: 16, borderWidth: 1.5, borderColor: '#1A255C',
  },
  statusIndicatorCircle: {
    width: 12, height: 12, borderRadius: 6,
  },
  statusTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  statusDesc:  { fontSize: 12, color: '#6b7280', marginTop: 2 },

  section: {
    backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 16,
    padding: 18, gap: 12,
    borderWidth: 1.5, borderColor: '#1A255C',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e3a5f', marginBottom: 4 },
  fieldLabel:  { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 4 },
  
  docTypeContainer: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4,
  },
  docTypeBadge: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  docTypeBadgeActive: {
    backgroundColor: '#d1fae5', borderColor: '#10b981',
  },
  docTypeBadgeText: { fontSize: 12, color: '#4b5563' },
  docTypeBadgeTextActive: { color: '#065f46', fontWeight: '700' },

  pickerRow: {
    flexDirection: 'row', gap: 10, marginVertical: 4,
  },
  pickerBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#3C7DC8',
    alignItems: 'center', justifyContent: 'center',
  },
  pickerBtnText: { fontSize: 13, fontWeight: '700', color: '#3c7dc8' },

  filePreviewCard: {
    backgroundColor: 'rgba(58,125,200,0.05)', borderWidth: 1, borderColor: 'rgba(58,125,200,0.2)',
    borderRadius: 10, padding: 12,
  },
  filePreviewTitle: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  filePreviewSub:   { fontSize: 11, color: '#6b7280', marginTop: 2 },

  submitBtn: {
    backgroundColor: '#1a6b5a', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  docRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e5e7eb',
  },
  docRowTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  docRowSub:   { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  docRowRight: { alignItems: 'flex-end' },

  badge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  badgeSuccess: { backgroundColor: '#d1fae5' },
  badgeError:   { backgroundColor: '#fee2e2' },
  badgeWarning: { backgroundColor: '#fef3c7' },
  badgeText:    { fontSize: 11, fontWeight: '700', color: '#374151' },
});
