import {
  Children,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  type SharedValue,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

import { flowSpring } from "../../constants/flow-motion";
import { cameraTransform } from "./FlowCamera";
import { useFlowSurfaceOpen } from "./FlowSurface";

type FlowScreenHandle = {
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
  settled: boolean;
  exit: (onDone?: () => void) => void;
};

export function useFlowScreen(): FlowScreenHandle {
  const progress = useSharedValue(1);
  const opacity = useSharedValue(1);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    progress.value = withSpring(0, flowSpring, (finished) => {
      if (finished) runOnJS(setSettled)(true);
    });
  }, [progress]);

  const exit = useCallback(
    (onDone?: () => void) => {
      opacity.value = withSpring(0, flowSpring);
      progress.value = withSpring(1, flowSpring, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      });
    },
    [progress, opacity]
  );

  return { progress, opacity, settled, exit };
}

type FlowScreenProps = {
  children: ReactNode;
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
  settled: boolean;
  snapshot?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function FlowScreen({
  children,
  progress,
  opacity,
  settled,
  snapshot,
  style,
}: FlowScreenProps) {
  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: cameraTransform(progress.value, 0.9),
  }));

  const snapshotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: cameraTransform(1 - progress.value, 1),
  }));

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: "#FFFFFF" }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
        {children}
      </Animated.View>
      {!settled && snapshot ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, snapshotStyle]}
          pointerEvents="none"
        >
          {snapshot}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

type FlowStaggerProps = {
  children: ReactNode;
  step?: number;
  delay?: number;
  factor?: number;
  fromOpacity?: number;
};

export function FlowStagger({
  children,
  step = 25,
  delay = 0,
  factor = 0.3,
  fromOpacity = 0,
}: FlowStaggerProps) {
  const open = useFlowSurfaceOpen();

  return (
    <>
      {Children.map(children, (child, index) => (
        <StaggeredEntry
          key={index}
          delay={delay + index * step}
          factor={factor}
          fromOpacity={fromOpacity}
          open={open}
        >
          {child}
        </StaggeredEntry>
      ))}
    </>
  );
}

function StaggeredEntry({
  children,
  delay,
  factor,
  fromOpacity,
  open,
}: {
  children: ReactNode;
  delay: number;
  factor: number;
  fromOpacity: number;
  open: SharedValue<number> | null;
}) {
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(0, flowSpring));
  }, [delay, progress]);

  useAnimatedReaction(
    () => open?.value ?? 0,
    (current, previous) => {
      if (!open || previous === undefined) return;
      if (previous === 0 && current > 0) {
        progress.value = 1;
        progress.value = withDelay(delay, withSpring(0, flowSpring));
      }
    },
    [open]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fromOpacity + (1 - fromOpacity) * (1 - progress.value),
    transform: cameraTransform(progress.value, factor),
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
