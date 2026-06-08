import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  type AlertButton,
  type AlertOptions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type PopupState = {
  title: string;
  message: string;
  buttons: AlertButton[];
  options?: AlertOptions;
} | null;

const DEFAULT_OK_BUTTON: AlertButton = { text: 'OK' };

export default function ThemedAlertHost() {
  const [popup, setPopup] = useState<PopupState>(null);

  useEffect(() => {
    const originalAlert = Alert.alert;

    Alert.alert = (
      title?: string,
      message?: string,
      buttons?: AlertButton[],
      options?: AlertOptions,
    ): void => {
      setPopup({
        title: title ?? '',
        message: message ?? '',
        buttons: buttons && buttons.length > 0 ? buttons : [DEFAULT_OK_BUTTON],
        options,
      });
    };

    return () => {
      Alert.alert = originalAlert;
    };
  }, []);

  const buttonItems = useMemo(() => popup?.buttons ?? [], [popup]);

  const close = (): void => {
    setPopup(null);
  };

  const onBackdropPress = (): void => {
    if (popup?.options?.cancelable) {
      close();
      popup.options?.onDismiss?.();
    }
  };

  return (
    <Modal visible={Boolean(popup)} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={onBackdropPress}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {popup?.title ? <Text style={styles.title}>{popup.title}</Text> : null}
          {popup?.message ? <Text style={styles.message}>{popup.message}</Text> : null}

          <View style={styles.buttonRow}>
            {buttonItems.map((button, index) => {
              const isDestructive = button.style === 'destructive';
              const isCancel = button.style === 'cancel';
              const textColor = isDestructive ? '#b42318' : isCancel ? '#0f5132' : '#ffffff';
              const bgColor = isDestructive ? '#fdecec' : isCancel ? '#dff3e4' : '#167353';

              return (
                <TouchableOpacity
                  key={`${button.text ?? 'btn'}-${index}`}
                  activeOpacity={0.85}
                  style={[styles.button, { backgroundColor: bgColor }]}
                  onPress={() => {
                    close();
                    button.onPress?.();
                  }}
                >
                  <Text style={[styles.buttonText, { color: textColor }]}>{button.text ?? 'OK'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 31, 23, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#f4fbf2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d7ead2',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    shadowColor: '#0f5132',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#115e3f',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#2b5f4a',
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  button: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
