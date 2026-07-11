import { Stack } from 'expo-router';

export default function WalletLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="wallet" />
      <Stack.Screen name="recharge" />
      <Stack.Screen name="transactions" />
    </Stack>
  );
}