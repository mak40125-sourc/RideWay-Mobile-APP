import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { signInWithEmail, signUpWithEmail } from "../../lib/supabase";

type Mode = "signin" | "signup";

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = mode === "signin"
    ? email.trim().length > 0 && password.length > 0
    : name.trim().length >= 2 && email.trim().length > 0 && password.length >= 6;

  const handleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await signUpWithEmail(email.trim(), password, name.trim());
      if (!result.session) {
        Alert.alert("Check your email", "We sent a confirmation link to complete your account.");
      }
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (mode === "signin") {
      handleSignIn();
    } else {
      handleSignUp();
    }
  };

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setName("");
    setEmail("");
    setPassword("");
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView bounces={false} contentContainerStyle={styles.shell} showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>RideWay</Text>

        <Text style={styles.title}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </Text>
        <Text style={styles.subtitle}>
          {mode === "signin"
            ? "Sign in to start earning."
            : "Enter your details to become a driver."}
        </Text>

        {mode === "signup" && (
          <>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              placeholder="Your full name"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          placeholder="you@example.com"
          placeholderTextColor="#9ca3af"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          placeholder={mode === "signin" ? "Your password" : "Min. 6 characters"}
          placeholderTextColor="#9ca3af"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, !isValid ? styles.buttonDisabled : null]}
          disabled={!isValid || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#f8f4ee" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === "signin" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={toggleMode} disabled={submitting}>
          <Text style={styles.toggleText}>
            {mode === "signin"
              ? "Don't have an account? Sign Up"
              : "Already have an account? Sign In"}
          </Text>
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
  toggleText: {
    color: "#6b7280",
    fontSize: 14,
    fontFamily: "NeueMontreal-Regular",
    textAlign: "center",
    marginTop: 20,
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
