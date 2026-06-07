import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="consumer-register" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="consumer-login" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="pending-approval" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
