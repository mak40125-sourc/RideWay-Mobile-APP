import { type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { flowCamera } from "../../constants/flow-motion";

type FlowParallaxProps = {
  children: ReactNode;
  progress: SharedValue<number>;
  factor: number;
  amplitude?: number;
  style?: StyleProp<ViewStyle>;
};

export function FlowParallax({
  children,
  progress,
  factor,
  amplitude = 48,
  style,
}: FlowParallaxProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const weight = Math.max(0, Math.min(1, factor));
    return {
      transform: [
        { perspective: flowCamera.perspective },
        { translateY: -p * weight * amplitude },
        { rotateX: `${p * weight * 2}deg` },
        { scale: 1 + p * weight * 0.02 },
      ],
    };
  });

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
