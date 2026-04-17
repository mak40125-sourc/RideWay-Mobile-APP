import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "../context/auth-context";
import { signInWithEmail, signOut, signUpWithEmail } from "../lib/supabase";
import { RiderHomeScreen } from "../screens/rider/home-screen";
import { RiderProfileScreen } from "../screens/rider/profile-screen";

export default function HomeScreen() {
  const { user, authUser, loading, isAuthenticated, refreshProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isProfileComplete = useMemo(() => {
    // Check DB profile first, then fall back to Auth Metadata 
    // This stops the "Two Login Screen" loop after Sign Up
    const hasDbName = !!(user && user.name);
    const hasMetadataName = !!(authUser?.user_metadata?.name || authUser?.user_metadata?.full_name);
    return hasDbName || hasMetadataName;
  }, [user, authUser]);

  const handleProfileComplete = useCallback(async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setIsRefreshing(false);
  }, [refreshProfile]);

  if (loading || isRefreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Loading RideWay...</Text>
      </View>
    );
  }

  // If not signed in, show Auth. 
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (!isProfileComplete) {
    return <RiderProfileScreen onComplete={handleProfileComplete} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Pressable
        style={styles.signOutButton}
        onPress={async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Failed to sign out");
          }
        }}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
      <RiderHomeScreen />
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Email and password are required");
      return;
    }

    if (isSignUp && !name) {
      Alert.alert("Error", "Name is required for sign up");
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        // SignUp usually signs the user in automatically. 
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      if (message.includes("phone signups are disabled")) {
        Alert.alert("Configuration Required", "Phone signups are currently disabled in your Supabase dashboard. Please enable the Phone provider in Authentication > Providers.");
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <Text style={styles.authTitle}>RideWay</Text>
      <Text style={styles.authSubtitle}>Pickup, match, ride</Text>
      <Text style={styles.authStatus}>
        {isSignUp ? "Create your account" : "Sign in to continue"}
      </Text>

      {isSignUp && (
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
          />
        </View>
      )}

      <View style={styles.inputWrapper}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputWrapper}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
      </View>

      <Pressable style={styles.authButton} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.authButtonText}>
            {isSignUp ? "Sign Up" : "Sign In"}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleButton}>
        <Text style={styles.toggleText}>
          {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  signOutButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  signOutText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "white",
  },
  authTitle: {
    fontSize: 32,
    fontFamily: "NeueMontreal-Bold",
    textAlign: "center",
    color: "#111111",
    marginBottom: 4,
  },
  authSubtitle: {
    fontSize: 14,
    fontFamily: "NeueMontreal-Regular",
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 32,
  },
  authStatus: {
    fontSize: 14,
    fontFamily: "NeueMontreal-Bold",
    textAlign: "center",
    color: "#111111",
    marginBottom: 32,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontFamily: "NeueMontreal-Bold",
    color: "#6B7280",
    marginBottom: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  input: {
    height: 52,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "NeueMontreal-Regular",
    backgroundColor: "#F5F5F5",
    color: "#111111",
  },
  authButton: {
    backgroundColor: "#111111",
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  authButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "NeueMontreal-Bold",
  },
  toggleButton: {
    marginTop: 16,
    alignItems: "center",
  },
  toggleText: {
    color: "#6B7280",
    fontSize: 14,
    fontFamily: "NeueMontreal-Regular",
  },
});
