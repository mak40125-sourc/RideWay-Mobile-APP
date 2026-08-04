import { useEffect, type ReactNode } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

import { flowCamera, flowSpring } from "../../constants/flow-motion";

type Props = {
  visible: boolean;
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down";
};

export function AnimatedSection({ visible, children, delay = 0, direction = "up" }: Props) {
  const progress = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      progress.value = withDelay(delay, withSpring(0, flowSpring));
    } else {
      progress.value = withSpring(1, flowSpring);
    }
  }, [visible, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p * 0.4,
      transform: [
        { perspective: flowCamera.perspective },
        { rotateY: `${p * 6}deg` },
        { translateY: p * (direction === "up" ? 20 : -20) },
        { scale: 1 - p * 0.02 },
      ],
    };
  });

  if (!visible) return null;

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
