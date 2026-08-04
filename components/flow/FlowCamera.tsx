import { type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { flowCamera } from "../../constants/flow-motion";

export function cameraTransform(progress: number, factor = 1, mirror = false) {
  "worklet";
  const weight = Math.max(0, Math.min(1, factor));
  const direction = mirror ? -1 : 1;
  return [
    { perspective: flowCamera.perspective },
    { rotateY: `${direction * progress * flowCamera.rotateY * weight}deg` },
    { rotateX: `${direction * progress * flowCamera.rotateX * weight}deg` },
    { scale: 1 - progress * (1 - flowCamera.scaleMin) * weight },
    { translateX: direction * progress * flowCamera.translateX * weight },
  ];
}

export function useFlowCamera(
  progress: SharedValue<number>,
  factor = 1,
  mirror = false
) {
  return useAnimatedStyle(() => ({
    transform: cameraTransform(progress.value, factor, mirror),
  }));
}

type FlowCameraProps = {
  children: ReactNode;
  progress: SharedValue<number>;
  factor?: number;
  mirror?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function FlowCamera({
  children,
  progress,
  factor = 1,
  mirror = false,
  style,
}: FlowCameraProps) {
  const animatedStyle = useFlowCamera(progress, factor, mirror);
  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
