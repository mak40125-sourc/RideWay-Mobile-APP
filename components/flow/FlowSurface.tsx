import {
  createContext,
  memo,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Profiler } from "react";
import Animated, {
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { flowSpring, flowSurface } from "../../constants/flow-motion";
import { cameraTransform } from "./FlowCamera";

type FlowSurfaceHandle = {
  open: SharedValue<number>;
  visible: boolean;
  present: () => void;
  dismiss: () => void;
};

export function useFlowSurface(): FlowSurfaceHandle {
  const open = useSharedValue(0);
  const [visible, setVisible] = useState(false);

  const present = useCallback(() => {
    setVisible(true);
    open.value = withSpring(1, flowSpring);
  }, [open]);

  const dismiss = useCallback(() => {
    open.value = withSpring(0, flowSpring, (finished) => {
      if (finished) runOnJS(setVisible)(false);
    });
  }, [open]);

  return { open, visible, present, dismiss };
}

const FlowSurfaceOpenContext = createContext<SharedValue<number> | null>(null);

export function useFlowSurfaceOpen(): SharedValue<number> | null {
  return useContext(FlowSurfaceOpenContext);
}

type FlowSurfaceProps = {
  open: SharedValue<number>;
  visible: boolean;
  world: ReactNode;
  layer: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function logRender(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number
) {
  console.log(
    `[flow-surface] ${id} ${phase} actual=${actualDuration.toFixed(2)}ms base=${baseDuration.toFixed(2)}ms`
  );
}

export const FlowSurface = memo(function FlowSurface({
  open,
  visible,
  world,
  layer,
  style,
}: FlowSurfaceProps) {
  const worldStyle = useAnimatedStyle(() => ({
    transform: cameraTransform(open.value, flowSurface.world),
  }));

  const layerStyle = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: cameraTransform(1 - open.value, flowSurface.layer, true),
  }));

  return (
    <View style={[styles.container, style]}>
      <Profiler id="flow-surface-world" onRender={logRender}>
        <Animated.View style={[StyleSheet.absoluteFill, worldStyle]}>
          {world}
        </Animated.View>
      </Profiler>
      <FlowSurfaceOpenContext.Provider value={open}>
        <Profiler id="flow-surface-layer" onRender={logRender}>
          <Animated.View
            style={[StyleSheet.absoluteFill, layerStyle]}
            pointerEvents={visible ? "auto" : "none"}
          >
            {layer}
          </Animated.View>
        </Profiler>
      </FlowSurfaceOpenContext.Provider>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
