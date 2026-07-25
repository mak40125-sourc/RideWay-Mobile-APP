import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AuthProvider } from "../contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

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
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
