import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "../context/auth-context";
import { useHomeStore } from "../store/homeStore";
import { LoginScreen } from "../components/auth/login-screen";
import { ProfileCreationScreen } from "../components/profile/profile-creation-screen";
import { useRiderRideSocket } from "../hooks/useRiderRideSocket";
import { useRideRecovery } from "../hooks/useRideRecovery";
import { rideLog, setDiagnosticScreen } from "../utils/ride-request-diagnostics";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    "GeneralSans-Regular": require("../assets/fonts/GeneralSans-Regular.otf"),
    "GeneralSans-Medium": require("../assets/fonts/GeneralSans-Medium.otf"),
    "GeneralSans-Bold": require("../assets/fonts/GeneralSans-Bold.otf"),
    "GeneralSans-Italic": require("../assets/fonts/GeneralSans-Italic.otf"),
    "GeneralSans-BoldItalic": require("../assets/fonts/GeneralSans-BoldItalic.otf"),
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
  const pathname = usePathname();
  // Rider realtime completion — joins rider:<userId> room, listens for ride:status_changed
  useRiderRideSocket(!!user);
  // Global recovery — authoritative backend reconciliation after crash/kill/foreground
  useRideRecovery();

  useEffect(() => {
    // Start the permission/GPS chain while auth restoration is still in
    // flight. The store's guard makes this exactly-once; the home screen
    // calls the same action as a fallback.
    void useHomeStore.getState().bootstrapLocation();
  }, []);

  useEffect(() => {
    // Reflect the current routed screen so every diagnostic log can attribute
    // the step to the screen the rider is actually on.
    setDiagnosticScreen(pathname && pathname !== "/" ? pathname.replace(/^\//, "").toUpperCase() : pathname === "/" ? "HOME" : "AUTH");
  }, [pathname]);

  useEffect(() => {
    // Surface unhandled JS exceptions so an interrupted searching/booking
    // step is visible in the trace instead of silently aborting.
    if (!__DEV__) return;

    const errorUtils = (globalThis as {
      ErrorUtils?: { setGlobalHandler: (h: (e: unknown, isFatal?: boolean) => void) => void };
    }).ErrorUtils;

    if (!errorUtils) return;

    errorUtils.setGlobalHandler((error, isFatal) => {
      rideLog("UNHANDLED_EXCEPTION", {
        isFatal: !!isFatal,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }, []);

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

  const deepScreenOptions = {
    contentStyle: { backgroundColor: "#FFFFFF" },
  };

  return (
    <Stack screenOptions={{ headerShown: false, animation: "none" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ride" />
      <Stack.Screen name="confirm" />
      <Stack.Screen name="tracking" />
      <Stack.Screen name="complete" />
      <Stack.Screen name="personal-info" options={deepScreenOptions} />
      <Stack.Screen name="ride-history" options={deepScreenOptions} />
      <Stack.Screen name="saved-places" options={deepScreenOptions} />
      <Stack.Screen name="emergency-contacts" options={deepScreenOptions} />
      <Stack.Screen name="notifications" options={deepScreenOptions} />
      <Stack.Screen name="help" options={deepScreenOptions} />
      <Stack.Screen name="privacy" options={deepScreenOptions} />
      <Stack.Screen name="about" options={deepScreenOptions} />
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
