import {
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { flowCamera, flowEasing, flowTiming } from "../../constants/flow-motion";

type FlowSheetProps = {
  state: string;
  children: ReactNode;
  duration?: number;
};

type PaneProps = {
  name: string;
  children: ReactNode;
};

function useLeavingStyle(progress: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p * 0.5,
      transform: [
        { perspective: flowCamera.perspective },
        { rotateY: `${p * flowCamera.rotateY}deg` },
        { rotateX: `${p * flowCamera.rotateX}deg` },
        { scale: 1 - p * (1 - flowCamera.scaleMin) },
        { translateX: p * flowCamera.translateX },
      ],
    };
  });
}

function useArrivingStyle(progress: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p * 0.5,
      transform: [
        { perspective: flowCamera.perspective },
        { rotateY: `${-p * flowCamera.rotateY}deg` },
        { rotateX: `${p * flowCamera.rotateX}deg` },
        { scale: 1 - p * (1 - flowCamera.scaleMin) },
        { translateX: -p * flowCamera.translateX },
      ],
    };
  });
}

export function Pane(_props: PaneProps) {
  return null;
}

export function FlowSheet({ state, children, duration = flowTiming.base }: FlowSheetProps) {
  const outProgress = useSharedValue(0);
  const inProgress = useSharedValue(0);

  const [rendered, setRendered] = useState(state);
  const [leaving, setLeaving] = useState<string | null>(null);

  const renderedRef = useRef(state);
  const busyRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const outDoneRef = useRef<() => void>(() => {});
  const interruptedRef = useRef<() => void>(() => {});

  const startEnter = useCallback(() => {
    inProgress.value = withTiming(0, {
      duration: Math.round(duration * 0.55),
      easing: flowEasing,
    });
  }, [duration, inProgress]);

  const dispatchOut = useCallback(() => {
    outDoneRef.current();
  }, []);

  const dispatchInterrupted = useCallback(() => {
    interruptedRef.current();
  }, []);

  const processTransition = useCallback((next: string) => {
    if (next === renderedRef.current || busyRef.current) {
      pendingRef.current = next;
      return;
    }

    busyRef.current = true;
    setLeaving(renderedRef.current);
    renderedRef.current = next;
    setRendered(next);

    outProgress.value = 0;
    inProgress.value = 1;
    outProgress.value = withTiming(1, {
      duration: Math.round(duration * 0.45),
      easing: flowEasing,
    }, (finished) => {
      if (finished) {
        runOnJS(dispatchOut)();
      } else {
        runOnJS(dispatchInterrupted)();
      }
    });
  }, [duration, outProgress, inProgress, dispatchOut, dispatchInterrupted]);

  const handleOutDone = useCallback(() => {
    setLeaving(null);
    busyRef.current = false;

    const next = pendingRef.current;
    pendingRef.current = null;

    if (next && next !== renderedRef.current) {
      processTransition(next);
    } else {
      startEnter();
    }
  }, [processTransition, startEnter]);

  const handleInterrupted = useCallback(() => {
    busyRef.current = false;

    const next = pendingRef.current;
    pendingRef.current = null;

    if (next && next !== renderedRef.current) {
      processTransition(next);
    } else {
      inProgress.value = 0;
    }
  }, [processTransition, inProgress]);

  useEffect(() => {
    outDoneRef.current = handleOutDone;
    interruptedRef.current = handleInterrupted;
  });

  useEffect(() => {
    if (state !== renderedRef.current) {
      processTransition(state);
    }
  }, [state, processTransition]);

  const leavingAnimatedStyle = useLeavingStyle(outProgress);
  const arrivingAnimatedStyle = useArrivingStyle(inProgress);

  const paneMap = useMemo(() => {
    const map = new Map<string, ReactNode>();
    const walk = (node: ReactNode) => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (!isValidElement(node)) return;
      if (node.type === Pane) {
        const name = (node.props as PaneProps).name;
        map.set(name, (node.props as PaneProps).children);
        return;
      }
    };
    walk(children);
    return map;
  }, [children]);

  const renderedContent = paneMap.get(rendered);

  return (
    <View>
      <Animated.View style={arrivingAnimatedStyle}>{renderedContent}</Animated.View>

      {leaving && leaving !== rendered ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={leavingAnimatedStyle}>{paneMap.get(leaving)}</Animated.View>
        </View>
      ) : null}
    </View>
  );
}

FlowSheet.Pane = Pane;
