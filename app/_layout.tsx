import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "../context/auth-context";
import { LoginScreen } from "../components/auth/login-screen";
import { ProfileCreationScreen } from "../components/profile/profile-creation-screen";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    "NeueMontreal-Regular": require("../assets/fonts/NeueMontreal-Regular.ttf"),
    "NeueMontreal-Bold": require("../assets/fonts/NeueMontreal-Bold.ttf"),
    "NeueMontreal-Italic": require("../assets/fonts/NeueMontreal-Italic.ttf"),
    "NeueMontreal-BoldItalic": require("../assets/fonts/NeueMontreal-BoldItalic.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { loading, isAuthenticated, user, refreshProfile } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#111111" />
        <Text style={styles.loadingText}>Loading RideWay...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const hasProfile = !!user?.full_name;

  if (!hasProfile) {
    return <ProfileCreationScreen onComplete={refreshProfile} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ride" />
      <Stack.Screen name="confirm" />
      <Stack.Screen name="tracking" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  loadingText: {
    marginTop: 12,
    color: "#666666",
    fontSize: 16,
  },
});
