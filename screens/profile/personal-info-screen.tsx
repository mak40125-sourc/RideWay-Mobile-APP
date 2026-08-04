import { useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput } from "react-native";

import { SubScreen, type SubScreenHandle } from "../../components/profile/SubScreen";
import { PressableScale } from "../../components/flow/PressableScale";
import { useAuth } from "../../context/auth-context";
import { updateProfile } from "../../lib/supabase";

export function PersonalInfoScreen() {
  const { user, authUser, refreshProfile } = useAuth();
  const subRef = useRef<SubScreenHandle>(null);
  const [name, setName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);

  const digitsOnlyPhone = phone.replace(/\D/g, "");
  const isValid = name.trim().length >= 2 && digitsOnlyPhone.length >= 10;

  const handleSave = async () => {
    if (!isValid || saving || !authUser) return;

    setSaving(true);
    try {
      await updateProfile(authUser.id, {
        full_name: name.trim(),
        phone: `+${digitsOnlyPhone}`,
      });
      await refreshProfile();
      subRef.current?.goBack();
    } catch (error) {
      const err = error as { message?: string; details?: string; code?: string };
      Alert.alert("Error", err?.message || err?.details || err?.code || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SubScreen ref={subRef} title="Personal Information">
      <Text style={styles.label}>Full name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your full name"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Phone number</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Your phone number"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        keyboardType="phone-pad"
      />

      <PressableScale
        scaleTo={0.97}
        onPress={handleSave}
        disabled={!isValid || saving}
        style={[styles.saveWrap, !isValid || saving ? styles.saveDisabled : null]}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveText}>Save Changes</Text>
        )}
      </PressableScale>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: "#111111",
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    color: "#111111",
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
  },
  saveWrap: {
    backgroundColor: "#111111",
    borderRadius: 18,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  saveDisabled: {
    opacity: 0.45,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
  },
});
