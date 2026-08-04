import { useCallback, type ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { flowPress, flowSpring } from "../../constants/flow-motion";

type PressableScaleProps = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  lift?: number;
  style?: StyleProp<ViewStyle>;
};

export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  scaleTo = flowPress.scale,
  lift = flowPress.lift,
  style,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const offset = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(scaleTo, { stiffness: 500, damping: 32 });
    offset.value = withSpring(-lift, { stiffness: 500, damping: 32 });
  }, [scaleTo, lift, scale, offset]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, flowSpring);
    offset.value = withSpring(0, flowSpring);
  }, [scale, offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: offset.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}
