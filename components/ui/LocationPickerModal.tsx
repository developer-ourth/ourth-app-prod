import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function LocationPickerModal({ visible, title, options, selected, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => (query.trim() === '' ? options : options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))),
    [options, query],
  );

  const handleSelect = (value: string) => {
    onSelect(value);
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <TextInput
            style={styles.search}
            placeholder="Search…"
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoFocus={false}
          />

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.item, item === selected && styles.itemActive]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[styles.itemText, item === selected && styles.itemTextActive]}>{item}</Text>
                {item === selected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No results found</Text>}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  closeBtn: { fontSize: 16, color: '#6b7280', fontWeight: '700' },
  search: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  itemActive: { backgroundColor: '#f0fdf4' },
  itemText: { fontSize: 15, color: '#374151' },
  itemTextActive: { color: '#1a6b5a', fontWeight: '600' },
  checkmark: { color: '#1a6b5a', fontWeight: '700', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 24, fontSize: 14 },
});
