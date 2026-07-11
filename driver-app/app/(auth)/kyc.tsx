import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { useDriverStore } from '../../store/driverStore';
import { driverAPI } from '../../services/driverAPI';
import { VerifyIdentity, type DocumentItem } from '../../screens/VerifyIdentity';

const REQUIRED_DOCUMENTS: DocumentItem[] = [
  { key: 'aadhaar', label: 'Aadhaar Card', description: 'Front & back copies', icon: 'document-text-outline' },
  { key: 'license', label: 'Driving License', description: 'Front & back copies', icon: 'id-card-outline' },
  { key: 'vehicle_rc', label: 'Vehicle RC', description: 'Front & back copies', icon: 'document-text-outline' },
  { key: 'insurance', label: 'Vehicle Insurance', description: 'Insurance document', icon: 'shield-outline' },
  { key: 'profile_photo', label: 'Profile Photo', description: 'Recent passport size photo', icon: 'camera-outline' },
];

type DocumentKey = (typeof REQUIRED_DOCUMENTS)[number]['key'];

export default function KYCUploadScreen() {
  const router = useRouter();
  const { authUser } = useAuth();
  const { addKYCDocument } = useDriverStore();
  const [uploading, setUploading] = useState<DocumentKey | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});

  const allUploaded = REQUIRED_DOCUMENTS.every((doc) => uploaded[doc.key]);

  useEffect(() => {
    (async () => {
      try {
        const existing = await driverAPI.getMyProfile();
        if (existing.is_verified) {
          router.replace('/(driver)/home');
        } else {
          router.replace('/(auth)/registration-pending');
        }
      } catch {
        // 404 — no profile yet, stay on KYC
      }
    })();
  }, []);

  const handleUpload = async (key: string) => {
    if (!authUser) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(key as DocumentKey);
    try {
      const uri = result.assets[0].uri;
      const publicUrl = await driverAPI.uploadDocument(uri, key);
      addKYCDocument({ document_type: key, document_url: publicUrl });
      setUploaded((prev) => ({ ...prev, [key]: true }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert('Upload failed', message);
    } finally {
      setUploading(null);
    }
  };

  const handleContinue = () => {
    if (!allUploaded) return;
    router.push('/(auth)/vehicle');
  };

  if (!authUser) {
    return <ActivityIndicator size="large" color="#111111" style={{ flex: 1 }} />;
  }

  return (
    <VerifyIdentity
      documents={REQUIRED_DOCUMENTS}
      uploaded={uploaded}
      allUploaded={allUploaded}
      onUpload={handleUpload}
      onContinue={handleContinue}
    />
  );
}
