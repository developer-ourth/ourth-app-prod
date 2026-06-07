import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Tag, ShoppingBag, ShoppingCart, Heart, Star, Bell } from '@/components/icons';

type AnyIcon = React.ComponentType<{ size: number; color: string }>;

type TabItem = {
  name: string;
  label: string;
  route: string;
  Icon: AnyIcon;
};

const TABS: TabItem[] = [
  { name: 'index',         label: 'Shop',        route: '/(tabs)',                Icon: Tag as AnyIcon },
  { name: 'orders',        label: 'Orders',      route: '/(tabs)/orders',         Icon: ShoppingBag as AnyIcon },
  { name: 'cart',          label: 'Cart',        route: '/(tabs)/cart',           Icon: ShoppingCart as AnyIcon },
  { name: 'collections',   label: 'Collections', route: '/(tabs)/collections',    Icon: Heart as AnyIcon },
  { name: 'rewards',       label: 'Rewards',     route: '/(tabs)/rewards',        Icon: Star as AnyIcon },
  { name: 'notifications', label: 'Alerts',      route: '/(tabs)/notifications',  Icon: Bell as AnyIcon },
];

type Props = {
  /** Pass a tab name to force-highlight it (e.g. 'index' on the product page). */
  activeTab?: string;
};

export default function BottomTabBar({ activeTab }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab
          ? tab.name === activeTab
          : pathname.endsWith(`/${tab.name}`) || (tab.name === 'index' && (pathname === '/' || pathname === '/(tabs)'));

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => router.push(tab.route as never)}
            activeOpacity={0.7}
          >
            <tab.Icon size={22} color={isActive ? '#16a34a' : '#9ca3af'} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    paddingTop: 6,
    height: Platform.OS === 'ios' ? 82 : 60,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9ca3af',
  },
  labelActive: {
    color: '#16a34a',
  },
});
