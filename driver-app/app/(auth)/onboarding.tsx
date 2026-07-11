import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { signInWithEmail, signUpWithEmail } from "../../lib/supabase";

type Mode = "signin" | "signup";

export default function OnboardingScreen() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid =
    mode === "signin"
      ? email.trim().length > 0 && password.length > 0
      : name.trim().length >= 2 && email.trim().length > 0 && password.length >= 6;

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && user?.full_name) {
        router.replace("/(driver)/home");
      } else if (isAuthenticated && !user?.full_name) {
        router.replace("/(auth)/kyc");
      }
    }
  }, [isAuthenticated, loading, user]);

  const handleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Sign in failed");
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
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (mode === "signin") handleSignIn();
    else handleSignUp();
  };

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setName("");
    setEmail("");
    setPassword("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.shell}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor="#6B7280"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#6B7280"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder={mode === "signin" ? "Your password" : "Min. 6 characters"}
          placeholderTextColor="#6B7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          disabled={!isValid || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === "signin" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleMode} disabled={submitting}>
          <Text style={styles.toggleText}>
            {mode === "signin"
              ? "Don't have an account? Sign Up"
              : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#111111",
  },
  shell: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logo: {
    fontSize: 34,
    color: "#FFFFFF",
    fontFamily: "NeueMontreal-Bold",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    color: "#FFFFFF",
    fontFamily: "NeueMontreal-Bold",
  },
  subtitle: {
    fontSize: 16,
    color: "#9CA3AF",
    fontFamily: "NeueMontreal-Regular",
    marginTop: 8,
    marginBottom: 32,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    color: "#9CA3AF",
    fontFamily: "NeueMontreal-Bold",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "NeueMontreal-Regular",
  },
  button: {
    backgroundColor: "#FFFFFF",
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
    color: "#111111",
    fontSize: 16,
    fontFamily: "NeueMontreal-Bold",
  },
  toggleText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontFamily: "NeueMontreal-Regular",
    textAlign: "center",
    marginTop: 20,
  },
  terms: {
    color: "#6B7280",
    fontSize: 12,
    fontFamily: "NeueMontreal-Regular",
    textAlign: "center",
    marginTop: 32,
    lineHeight: 18,
  },
});
