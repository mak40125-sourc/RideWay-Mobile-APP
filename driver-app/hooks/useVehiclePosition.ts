import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useNavigationStore } from '../store/navigationStore';
import { snapToRoutePoint } from '../services/osrmNavigation';
import {
  angleDiff,
  bearingBetween,
  coordDistanceM,
  easeInOutCubic,
  interpolateBearing,
  interpolateCoord,
  isValidHeading,
} from '../services/geoMotion';
import { diagLogger } from '../utils/diagLog';
import type { Coordinate } from '../types/navigation';

// Motion tuning (metres / milliseconds).
const JUMP_RESET_M = 80; // above this, teleport instead of animating across a gap
const TARGET_SPEED_MPS = 14; // ~50 km/h; used to derive animation duration
const MIN_DURATION_MS = 600;
const MAX_DURATION_MS = 2000;
const STATIONARY_M = 1.0; // below this the vehicle is treated as stationary
const HEADING_MIN_CHANGE_DEG = 2; // ignore tiny compass noise

type PosAnim = { from: Coordinate; to: Coordinate; start: number; dur: number };
type HdgAnim = { from: number; to: number; start: number; dur: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Smooths raw GPS fixes into a continuously-moving display position + heading
 * for the vehicle marker. Navigation *state* is never mutated: this only
 * interpolates a render target between fixes, snaps the visual to the route,
 * cancels an in-flight animation when a newer fix lands, and teleports across
 * unreasonable GPS jumps. When GPS is unavailable no movement is invented.
 */
export function useVehicleMotion() {
  const rawPos = useNavigationStore((s) => s.position);
  const rawHeading = useNavigationStore((s) => s.heading);
  const flattened = useNavigationStore((s) => s.route?.flattened ?? null);

  const [displayPos, setDisplayPos] = useState<Coordinate | null>(rawPos);
  const headingDeg = useSharedValue(rawHeading ?? 0);

  // DIAG
  useEffect(() => {
    diagLogger.log(
      'NAV_DISPLAY_POS',
      `displayPos=${displayPos ? `${displayPos.latitude.toFixed(5)},${displayPos.longitude.toFixed(5)}` : 'null'} rawPos=${rawPos ? `${rawPos.latitude.toFixed(5)},${rawPos.longitude.toFixed(5)}` : 'null'} rawHdg=${String(rawHeading)} hdgDeg=${headingDeg.value.toFixed(1)} flattenedPts=${flattened?.coords?.length ?? 0}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayPos]);

  useEffect(() => {
    diagLogger.log(
      'NAV_RAW_FIX',
      `rawPos=${rawPos ? `${rawPos.latitude.toFixed(5)},${rawPos.longitude.toFixed(5)}` : 'null'} rawHdg=${String(rawHeading)} flattenedPts=${flattened?.coords?.length ?? 0} displayPos=${displayPos ? `${displayPos.latitude.toFixed(5)},${displayPos.longitude.toFixed(5)}` : 'null'}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPos, rawHeading]);

  const posRef = useRef<Coordinate | null>(rawPos);
  const posAnim = useRef<PosAnim | null>(null);
  const hdgAnim = useRef<HdgAnim | null>(null);
  const rafRef = useRef<number | null>(null);
  const stepRef = useRef<() => void>(() => {});

  const run = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      stepRef.current();
    });
  }, []);

  // Advance one animation frame; reschedules itself until both the position
  // and heading animations settle, then goes idle (zero renders while parked).
  stepRef.current = () => {
    const now = Date.now();
    let busy = false;

    const pa = posAnim.current;
    if (pa) {
      const t = pa.dur > 0 ? Math.min(1, (now - pa.start) / pa.dur) : 1;
      const next = interpolateCoord(pa.from, pa.to, easeInOutCubic(t));
      posRef.current = next;
      setDisplayPos(next);
      if (t >= 1) posAnim.current = null;
      else busy = true;
    }

    const ha = hdgAnim.current;
    if (ha) {
      const t = ha.dur > 0 ? Math.min(1, (now - ha.start) / ha.dur) : 1;
      headingDeg.value = interpolateBearing(ha.from, ha.to, easeInOutCubic(t));
      if (t >= 1) hdgAnim.current = null;
      else busy = true;
    }

    if (busy) run();
  };

  const applyFix = useCallback(
    (pos: Coordinate | null, gpsHdg: number | null) => {
      if (!pos) {
        diagLogger.log('NAV_APPLYFIX_SKIP', 'reason=noPos');
        return;
      }

      // Snap the visual target to the route when a route exists. This only
      // affects the rendered marker; the engine's progress/off-route metrics
      // still run off the raw store position.
      let target: Coordinate = pos;
      if (flattened) {
        const snapped = snapToRoutePoint(pos, flattened);
        if (snapped) target = snapped;
      }

      const from = posRef.current;
      const distance = from ? coordDistanceM(from, target) : 0;

      // Unreasonable GPS jump (resume after a gap, reroute, bad fix) → reset
      // interpolation so the vehicle teleports instead of gliding across space.
      if (!from || distance > JUMP_RESET_M) {
        posRef.current = target;
        setDisplayPos(target);
        posAnim.current = null;
      } else {
        const dur = clamp((distance / TARGET_SPEED_MPS) * 1000, MIN_DURATION_MS, MAX_DURATION_MS);
        posAnim.current = { from, to: target, start: Date.now(), dur };
      }

      // Heading target: prefer the compass, otherwise the direction of travel
      // when actually moving; otherwise hold the current heading (no spin).
      let targetHdg = headingDeg.value;
      if (isValidHeading(gpsHdg)) {
        targetHdg = gpsHdg;
      } else if (from && distance > STATIONARY_M) {
        targetHdg = bearingBetween(from, target);
      }

      if (from && Math.abs(angleDiff(headingDeg.value, targetHdg)) > HEADING_MIN_CHANGE_DEG) {
        hdgAnim.current = { from: headingDeg.value, to: targetHdg, start: Date.now(), dur: MIN_DURATION_MS };
      } else {
        hdgAnim.current = null;
        headingDeg.value = targetHdg;
      }

      run();
    },
    [flattened, headingDeg, run]
  );

  useEffect(() => {
    applyFix(rawPos, rawHeading);
  }, [rawPos, rawHeading, applyFix]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { displayPos, headingDeg, rawPos };
}