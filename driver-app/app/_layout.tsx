import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { useRideReconciliation } from "../hooks/useRideReconciliation";
import { useDriverStartup } from "../hooks/useDriverStartup";
import { useStartupStore } from "../store/startupStore";
import { diagLogger } from "../utils/diagLog";

SplashScreen.preventAutoHideAsync();
diagLogger.log('APP_BOOT');

function RideStateReconciler() {
  useRideReconciliation();
  return null;
}

function StartupOrchestrator() {
  useDriverStartup();
  return null;
}

function RouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    diagLogger.setRoute(pathname);
    diagLogger.log('NAVIGATE', pathname);
  }, [pathname]);
  return null;
}

function BootstrapSplashGate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { authState } = useAuth();
  const appReady = useStartupStore((s) => s.appReady);
  const hiddenRef = useRef(false);
  useEffect(() => {
    const canHide = fontsLoaded && (authState === 'UNAUTHENTICATED' || (authState !== 'BOOTSTRAPPING' && appReady));
    if (canHide && !hiddenRef.current) {
      hiddenRef.current = true;
      diagLogger.log('STARTUP_READY', `authState=${authState} fontsLoaded=${fontsLoaded} appReady=${appReady}`);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, authState, appReady]);
  return null;
}

function StartupGate({ children }: { children: React.ReactNode }) {
  const { authState } = useAuth();
  const appReady = useStartupStore((s) => s.appReady);
  const phase = useStartupStore((s) => s.phase);
  if (authState === 'BOOTSTRAPPING') return null;
  if (authState === 'AUTHENTICATED' && !appReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>RideWay</Text>
        <Text style={{ color: '#9CA3AF', marginTop: 8 }}>Recovering ride… ({phase})</Text>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 24 }} />
      </View>
    );
  }
  return <>{children}</>;
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  return (
    <>
      <BootstrapSplashGate fontsLoaded={fontsLoaded} />
      <StartupOrchestrator />
      <RideStateReconciler />
      <RouteTracker />
      <StartupGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(driver)" />
          <Stack.Screen name="(tabs)" options={{ animation: 'slide_from_left' }} />
          <Stack.Screen name="(wallet)" />
          <Stack.Screen name="(referral)" />
          <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
          <Stack.Screen name="index" />
        </Stack>
      </StartupGate>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    "NeueMontreal-Regular": require("../assets/fonts/NeueMontreal-Regular.ttf"),
    "NeueMontreal-Bold": require("../assets/fonts/NeueMontreal-Bold.ttf"),
    "NeueMontreal-Italic": require("../assets/fonts/NeueMontreal-Italic.ttf"),
    "NeueMontreal-BoldItalic": require("../assets/fonts/NeueMontreal-BoldItalic.ttf"),
    "GeneralSans-Regular": require("../assets/fonts/GeneralSans-Regular.otf"),
    "GeneralSans-Medium": require("../assets/fonts/GeneralSans-Medium.otf"),
    "GeneralSans-Semibold": require("../assets/fonts/GeneralSans-Semibold.otf"),
    "GeneralSans-Bold": require("../assets/fonts/GeneralSans-Bold.otf"),
  });

  useEffect(() => {
    if (loaded) {
      diagLogger.log('APP_LAUNCH');
      diagLogger.setRoute('/');
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <RootNavigator fontsLoaded={loaded} />
    </AuthProvider>
  );
}
