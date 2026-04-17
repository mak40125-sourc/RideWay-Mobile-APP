import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="pickup-navigation" />
      <Stack.Screen name="ride-progress" />
      <Stack.Screen name="drop-navigation" />
      <Stack.Screen name="ride-completed" />
    </Stack>
  );
}