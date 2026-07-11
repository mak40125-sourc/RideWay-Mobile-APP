import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../../store/driverStore';
import { driverAPI } from '../../services/driverAPI';
import { colors, spacing, fontSize } from '../../constants/theme';

const VEHICLE_TYPES = [
  { value: 'bike', label: 'Bike' },
  { value: 'mini', label: 'Mini' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'shuttle', label: 'Shuttle' },
];

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const { kycDocuments, setDriver, setVehicleInfo, clearKYCDocuments } = useDriverStore();
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValid = vehicleType && vehicleNumber && vehicleModel && vehicleColor;

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
        // 404 — no profile yet, proceed
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!isValid) return;

    setSubmitting(true);
    try {
      const driver = await driverAPI.register({
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.toUpperCase(),
        vehicle_model: vehicleModel,
        vehicle_color: vehicleColor,
        documents: kycDocuments,
      });

      setDriver(driver);
      setVehicleInfo({
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.toUpperCase(),
        vehicle_model: vehicleModel,
        vehicle_color: vehicleColor,
      });
      clearKYCDocuments();

      router.replace('/(auth)/registration-pending');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save vehicle details';
      if (message.includes('409') || message.includes('already exists')) {
        router.replace('/(auth)/registration-pending');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Vehicle Details</Text>
      <Text style={styles.subtitle}>Add your vehicle information to start driving</Text>

      <Text style={styles.label}>Vehicle Type</Text>
      <View style={styles.typeRow}>
        {VEHICLE_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[styles.typeBtn, vehicleType === type.value && styles.typeBtnActive]}
            onPress={() => setVehicleType(type.value)}
          >
            <Text style={[styles.typeBtnText, vehicleType === type.value && styles.typeBtnTextActive]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Vehicle Number</Text>
      <TextInput
        style={styles.input}
        placeholder="KA-01-AB-1234"
        placeholderTextColor={colors.textMuted}
        value={vehicleNumber}
        onChangeText={setVehicleNumber}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Vehicle Model</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Honda Activa 6G"
        placeholderTextColor={colors.textMuted}
        value={vehicleModel}
        onChangeText={setVehicleModel}
      />

      <Text style={styles.label}>Vehicle Color</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Red"
        placeholderTextColor={colors.textMuted}
        value={vehicleColor}
        onChangeText={setVehicleColor}
      />

      <TouchableOpacity
        style={[styles.button, (!isValid || submitting) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <Text style={styles.buttonText}>Save & Continue</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    fontFamily: 'NeueMontreal-Bold',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    fontFamily: 'NeueMontreal-Regular',
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    fontFamily: 'NeueMontreal-Bold',
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeBtnText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
    fontFamily: 'NeueMontreal-Regular',
  },
  typeBtnTextActive: {
    color: colors.background,
    fontFamily: 'NeueMontreal-Bold',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: 'NeueMontreal-Regular',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontWeight: '600',
    fontFamily: 'NeueMontreal-Bold',
  },
});
