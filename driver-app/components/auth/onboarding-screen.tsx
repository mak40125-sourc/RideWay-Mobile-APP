import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "../../contexts/AuthContext";
import { updateProfile } from "../../lib/supabase";

interface OnboardingScreenProps {
  onComplete: () => Promise<void>;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { authUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = fullName.trim().length >= 2 && phone.trim().length >= 8;

  const handleSubmit = async () => {
    if (!authUser || submitting || !isValid) return;

    setSubmitting(true);
    try {
      await updateProfile(authUser.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        role: "driver",
      });
      await onComplete();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Profile creation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView bounces={false} contentContainerStyle={styles.shell} showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>RideWay</Text>

        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>
          Enter your details to start driving with RideWay.
        </Text>

        <Text style={styles.label}>Full name</Text>
        <TextInput
          placeholder="Your full name"
          placeholderTextColor="#9ca3af"
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Phone number</Text>
        <TextInput
          placeholder="+1 555 000 0000"
          placeholderTextColor="#9ca3af"
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Pressable
          style={[styles.button, !isValid ? styles.buttonDisabled : null]}
          disabled={!isValid || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#f8f4ee" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </Pressable>

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
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
  terms: {
    color: "#9ca3af",
    fontSize: 12,
    fontFamily: "NeueMontreal-Regular",
    textAlign: "center",
    marginTop: 32,
    lineHeight: 18,
  },
});
