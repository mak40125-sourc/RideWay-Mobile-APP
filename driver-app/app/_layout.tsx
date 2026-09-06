import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { useRideReconciliation } from "../hooks/useRideReconciliation";
import { diagLogger } from "../utils/diagLog";

SplashScreen.preventAutoHideAsync();
diagLogger.log('APP_BOOT');

function RideStateReconciler() {
  useRideReconciliation();
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
  const hiddenRef = useRef(false);
  useEffect(() => {
    if (fontsLoaded && authState !== 'BOOTSTRAPPING' && !hiddenRef.current) {
      hiddenRef.current = true;
      diagLogger.log('STARTUP_READY', `authState=${authState} fontsLoaded=${fontsLoaded}`);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, authState]);
  return null;
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  return (
    <>
      <BootstrapSplashGate fontsLoaded={fontsLoaded} />
      <RideStateReconciler />
      <RouteTracker />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(tabs)" options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="(wallet)" />
        <Stack.Screen name="(referral)" />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="index" />
      </Stack>
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
