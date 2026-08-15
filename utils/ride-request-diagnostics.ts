/**
 * RideFlow diagnostics — temporary instrumentation to trace why a rider
 * sometimes leaves the ride-searching flow after requesting a ride.
 *
 * This module is a development tracer. It is a no-op in production builds.
 * Do not ship; remove once the intermittent navigation bug is root-caused.
 *
 * Every emitted log includes:
 *   ts       — ISO timestamp
 *   event    — semantic name of the step
 *   rideId   — active ride id (or "-" before a ride exists)
 *   user     — the acting rider id (or "-")
 *   screen   — current screen name ("unknown" if not yet captured)
 *   network  — last known network state ("unknown"/"online"/"offline")
 */
import { Platform } from "react-native";

let currentScreen = "unknown";
let networkState: "unknown" | "online" | "offline" = "unknown";

export function setDiagnosticScreen(screen: string) {
  if (screen !== currentScreen) {
    currentScreen = screen;
    rideLog("SCREEN_CHANGED", { screen });
  }
}

export function getDiagnosticScreen() {
  return currentScreen;
}

export function setDiagnosticNetwork(state: "unknown" | "online" | "offline") {
  networkState = state;
}

export function getDiagnosticNetwork() {
  return networkState;
}

type RideDiagnosticData = {
  rideId?: string | null;
  userId?: string | null;
  [key: string]: unknown;
};

export function rideLog(event: string, data: RideDiagnosticData = {}) {
  if (!__DEV__) return;

  const entry = {
    ts: new Date().toISOString(),
    event,
    rideId: data.rideId ?? "-",
    user: data.userId ?? "-",
    screen: currentScreen,
    network: networkState,
    platform: Platform.OS,
    ...data,
  };

  // Bucket ride-transition calls on one tag so they stand out while keeping
  // plain HTTP logs separately tagged below.
  const tag = event.startsWith("HTTP") ? "HTTPFLOW" : "RIDEFLOW";
  console[event.startsWith("HTTP_ERROR") ? "warn" : "log"](`[${tag}]`, JSON.stringify(entry));
}