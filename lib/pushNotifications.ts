import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from '@/lib/api';

/** True when running inside Expo Go (remote push not supported since SDK 53). */
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

// How foreground notifications are presented
if (!isExpoGo) {
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});
}

/**
 * Request permission and register the Expo push token with the backend.
 * Safe to call multiple times — de-duped server-side via upsert.
 * Returns the Expo push token string, or null if permission was denied or
 * this is running on a simulator (physical device required for push).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Remote push not supported in Expo Go since SDK 53 — skip silently
  if (isExpoGo) {
    return null;
  }

  if (!Device.isDevice) {
    return null;
  }

  // Android requires an explicit notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1a6b5a',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Register with backend (fire-and-forget; failures are non-fatal)
    await api.post('/me/device-token', {
      token,
      platform: Platform.OS, // 'android' | 'ios'
    }).catch(() => {});

    return token;
  } catch {
    return null;
  }
}

/**
 * Unregister a push token from the backend on logout.
 */
export async function unregisterPushToken(token: string): Promise<void> {
  await api.delete('/me/device-token', { data: { token } }).catch(() => {});
}
