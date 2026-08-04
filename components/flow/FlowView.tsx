import { useEffect, type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { flowSpring } from "../../constants/flow-motion";
import { useFlowCamera } from "./FlowCamera";

type FlowViewProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  factor?: number;
};

export function FlowView({ children, style, factor = 0.6 }: FlowViewProps) {
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withSpring(0, flowSpring);
  }, [progress]);

  const animatedStyle = useFlowCamera(progress, factor);

  return <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>{children}</Animated.View>;
}
