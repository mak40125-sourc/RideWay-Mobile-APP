import { Stack } from 'expo-router';

export default function ModalLayout() {
  return (
    <Stack screenOptions={{ presentation: 'modal', headerShown: false }}>
      <Stack.Screen name="ride-request" />
      <Stack.Screen name="low-balance" />
    </Stack>
  );
}
