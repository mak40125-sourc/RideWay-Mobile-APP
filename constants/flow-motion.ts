import { Easing } from "react-native-reanimated";

export const flowTiming = {
  short: 320,
  base: 350,
  long: 380,
};

export const flowSpring = {
  stiffness: 320,
  damping: 28,
  mass: 0.9,
};

export const flowEasing = Easing.out(Easing.cubic);

export const flowCamera = {
  perspective: 1000,
  rotateY: 12,
  rotateX: 2,
  scaleMin: 0.985,
  translateX: 24,
};

export const flowLayers = {
  map: 0.05,
  controls: 0.18,
  indicators: 0.3,
  cards: 0.45,
  sheet: 0.6,
  overlay: 0.8,
};

export const flowPress = {
  scale: 0.96,
  lift: 2,
};

export const flowSurface = {
  world: 0.6,
  layer: 1,
};

export type FlowProgress = { value: number };
