import '../global.css';
import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { useAuthStore } from '@/lib/store';
import { registerForPushNotifications, isExpoGo } from '@/lib/pushNotifications';
import ThemedAlertHost from '@/components/ui/ThemedAlertHost';

// Initialize Sentry crash analytics
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || 'https://placeholder-dsn@o0.ingest.sentry.io/0',
  debug: false,
  tracesSampleRate: 1.0,
});

/**
 * Root layout — initialises auth state and redirects:
 *  • unauthenticated → /auth/login
 *  • authenticated   → /(tabs)
 */
function RootLayout() {
  const { token, isLoading, initialize } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Rehydrate persisted token on first load
  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [token, isLoading, segments]);

  // Register for push notifications once the user is authenticated
  useEffect(() => {
    if (!token || isExpoGo) return;

    void registerForPushNotifications();

    // Show foreground notifications in the notification tray
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Notification received while app is foregrounded — handled by setNotificationHandler
    });

    // Navigate to orders screen when user taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type && String(data.type).startsWith('order_')) {
        router.push('/(tabs)/orders');
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [token]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/payment" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/support" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/general" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/address" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/payment-methods" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/tax-settings" options={{ presentation: 'card' }} />
      </Stack>
      <ThemedAlertHost />
    </>
  );
}

export default Sentry.wrap(RootLayout);
