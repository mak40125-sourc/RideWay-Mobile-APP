import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring, withTiming, useSharedValue } from 'react-native-reanimated';

interface MenuButtonProps {
  onPress: () => void;
}

export default function MenuButton({ onPress }: MenuButtonProps) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 90 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 16, left: 16 },
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={styles.touchArea}
      >
        <View style={styles.icon}>
          <View style={styles.line} />
          <View style={[styles.line, styles.lineMiddle]} />
          <View style={styles.line} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 20,
  },
  touchArea: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 20,
    height: 14,
    justifyContent: 'space-between',
  },
  line: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#111111',
  },
  lineMiddle: {
    width: 14,
    alignSelf: 'flex-end',
  },
});
