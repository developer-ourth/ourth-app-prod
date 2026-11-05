import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import * as Updates from 'expo-updates';

/** Don't ask Expo for updates more often than this when the app returns to the foreground. */
const FOREGROUND_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Over-the-air updates (EAS Update). Expo already checks on launch; this also checks
 * when the app returns to the foreground and, once an update has downloaded, offers
 * a one-tap restart instead of waiting for the next cold start.
 *
 * Disabled in development and in builds without expo-updates (e.g. Expo Go).
 */
export default function OtaUpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    const check = async () => {
      if (Date.now() - lastCheck.current < FOREGROUND_CHECK_INTERVAL_MS) return;
      lastCheck.current = Date.now();

      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync(); // sets isUpdatePending when done
        }
      } catch (e) {
        // Offline or Expo unreachable: the next foreground check will try again
        console.warn('OTA update check failed', e);
      }
    };

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });

    return () => subscription.remove();
  }, []);

  if (__DEV__ || !Updates.isEnabled || !isUpdatePending || dismissed) {
    return null;
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 96,
        backgroundColor: '#1a6b5a',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      <Text style={{ color: 'white', flex: 1, fontWeight: '600' }}>A new version of OURTH is ready.</Text>
      <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
        <Text style={{ color: 'white', opacity: 0.8 }}>Later</Text>
      </Pressable>
      <Pressable
        onPress={() => void Updates.reloadAsync()}
        style={{ backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
      >
        <Text style={{ color: '#1a6b5a', fontWeight: '700' }}>Restart now</Text>
      </Pressable>
    </View>
  );
}
