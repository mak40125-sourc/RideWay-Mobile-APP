import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
  onLogout: () => void;
  driverName?: string;
}

const MENU_WIDTH = 280;
const ITEMS = [
  { label: 'Refer & Earn', route: '/(referral)/earn' },
  { label: 'Driver Profile', route: '/(tabs)/profile' },
  { label: 'Ride History', route: '/(tabs)/history' },
  { label: 'Earnings', route: '/(tabs)/earnings' },
  { label: 'Settings', route: '/(tabs)/settings' },
  { label: 'Help & Support', route: '/(tabs)/settings' },
];

export default function SideMenu({ isOpen, onClose, onNavigate, onLogout, driverName }: SideMenuProps) {
  const insets = useSafeAreaInsets();
  const panelX = useSharedValue(-MENU_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      backdropOpacity.value = withTiming(1, { duration: 250, easing: Easing.bezier(0.16, 1, 0.3, 1) });
      panelX.value = withTiming(0, {
        duration: 350,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      panelX.value = withTiming(-MENU_WIDTH, { duration: 250, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    }
  }, [isOpen, backdropOpacity, panelX]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panelX.value }],
  }));

  return (
    <Animated.View
      style={[styles.backdrop, backdropStyle]}
      pointerEvents={isOpen ? 'auto' : 'none'}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View style={[styles.panel, panelStyle]}>
        <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color="#111111" />
          </TouchableOpacity>

          {isOpen && (
            <View style={styles.itemContainer}>
              <Animated.View
                entering={FadeIn.delay(80).duration(350)}
                exiting={FadeOut.duration(150)}
              >
                <Text style={styles.greeting}>
                  {driverName ? `Hi, ${driverName.split(' ')[0]}` : 'Hi'}
                </Text>
              </Animated.View>

              <View style={styles.divider} />

              {ITEMS.map((item, index) => (
                <Animated.View
                  key={item.label}
                  entering={FadeIn.delay(120 + index * 60).duration(350)}
                  exiting={FadeOut.duration(100)}
                >
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => onNavigate(item.route)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.menuItemText}>{item.label}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}

              <Animated.View
                entering={FadeIn.delay(120 + ITEMS.length * 60).duration(350)}
                exiting={FadeOut.duration(100)}
              >
                <View style={styles.logoutSection}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={onLogout}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.logoutText}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              <Text style={styles.version}>RideWay Driver v1.0.0</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 15,
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MENU_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContainer: {
    flex: 1,
    paddingTop: 32,
  },
  greeting: {
    fontFamily: 'GeneralSans-Semibold',
    fontSize: 28,
    color: '#111111',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 28,
  },
  menuItem: {
    paddingVertical: 14,
  },
  menuItemText: {
    fontFamily: 'GeneralSans-Regular',
    fontSize: 18,
    color: '#111111',
    letterSpacing: -0.2,
  },
  logoutSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  logoutText: {
    fontFamily: 'GeneralSans-Regular',
    fontSize: 18,
    color: '#EF4444',
    letterSpacing: -0.2,
  },
  version: {
    fontFamily: 'GeneralSans-Regular',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 'auto',
    marginBottom: 32,
  },
});
