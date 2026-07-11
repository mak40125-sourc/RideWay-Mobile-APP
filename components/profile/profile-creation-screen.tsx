import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "../../context/auth-context";
import { updateProfile } from "../../lib/supabase";

type ProfileCreationScreenProps = {
  onComplete?: () => void;
};

export function ProfileCreationScreen({ onComplete }: ProfileCreationScreenProps) {
  const { authUser } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const digitsOnlyPhone = phone.replace(/\D/g, "");
  const isValid = name.trim().length >= 2 && digitsOnlyPhone.length >= 10;

  const completeProfile = async () => {
    if (saving || !authUser) return;

    setSaving(true);
    try {
      await updateProfile(authUser.id, {
        full_name: name.trim(),
        phone: `+${digitsOnlyPhone}`,
        role: "rider",
      });

      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      const err = error as { message?: string; details?: string; code?: string };
      Alert.alert("Error", err?.message || err?.details || err?.code || "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView bounces={false} contentContainerStyle={styles.shell} showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>RideWay</Text>

        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>
          Add your name and phone number to start booking rides.
        </Text>

        <Text style={styles.label}>Full name</Text>
        <TextInput
          placeholder="Your full name"
          placeholderTextColor="#9ca3af"
          style={styles.input}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Phone number</Text>
        <TextInput
          placeholder="Your phone number"
          placeholderTextColor="#9ca3af"
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Pressable
          style={[styles.button, !isValid ? styles.buttonDisabled : null]}
          disabled={!isValid || saving}
          onPress={completeProfile}
        >
          {saving ? (
            <ActivityIndicator color="#f8f4ee" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4efe7",
  },
  shell: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  logo: {
    color: "#0d141c",
    fontSize: 34,
    fontFamily: "NeueMontreal-Bold",
    marginBottom: 32,
  },
  title: {
    color: "#0d141c",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "NeueMontreal-Bold",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 32,
    fontFamily: "NeueMontreal-Regular",
  },
  label: {
    color: "#0d141c",
    fontSize: 14,
    fontFamily: "NeueMontreal-Bold",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8ddd0",
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    color: "#0d141c",
    fontSize: 16,
    fontFamily: "NeueMontreal-Regular",
  },
  button: {
    backgroundColor: "#0d141c",
    borderRadius: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#f8f4ee",
    fontSize: 16,
    fontFamily: "NeueMontreal-Bold",
  },
});
