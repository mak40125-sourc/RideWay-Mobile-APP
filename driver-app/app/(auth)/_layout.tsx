import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="kyc" />
      <Stack.Screen name="vehicle" />
      <Stack.Screen name="registration-pending" />
    </Stack>
  );
}
