import { router, usePathname } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";

import { RideMap } from "../../components/Map/RideMap";
import { BottomSheetHandle } from "../../components/BottomSheet/BottomSheetHandle";
import { BottomSheetContent } from "../../components/BottomSheet/BottomSheetContent";
import { FlowView } from "../../components/flow/FlowView";
import { FlowParallax } from "../../components/flow/FlowParallax";
import { FlowSurface, useFlowSurface } from "../../components/flow/FlowSurface";
import { PressableScale } from "../../components/flow/PressableScale";
import { flowLayers } from "../../constants/flow-motion";
import { useHomeStore } from "../../store/homeStore";
import { useRideStore } from "../../context/ride-store";
import { useAuth } from "../../context/auth-context";
import { useActiveRideDiscovery } from "../../hooks/useActiveRideDiscovery";
import { getRouteEstimate } from "../../services/osrm";
import { calculateRideFare } from "../../components/ride/ride-helpers";
import { cancelRide } from "../../services/ride.service";
import { reverseGeocode } from "../../services/places";
import { ProfileSurface } from "./profile-screen";
import { rideLog, setDiagnosticScreen } from "../../utils/ride-request-diagnostics";

export function RiderHomeScreen() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const sheetIndex = useSharedValue(0);
  const { user } = useAuth();
  const profile = useFlowSurface();
  const { open: surfaceOpen, visible: surfaceVisible, present: presentProfile, dismiss: dismissProfile } = profile;

  useEffect(() => {
    setDiagnosticScreen("HOME");
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (surfaceVisible) {
        dismissProfile();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [surfaceVisible, dismissProfile]);

  const location = useHomeStore((s) => s.location);
  const permissionDenied = useHomeStore((s) => s.permissionDenied);
  const loadingLocation = useHomeStore((s) => s.loadingLocation);
  const pickup = useHomeStore((s) => s.pickup);
  const destination = useHomeStore((s) => s.destination);
  const estimate = useHomeStore((s) => s.estimate);
  const selectedOption = useHomeStore((s) => s.selectedOption);
  const setPickup = useHomeStore((s) => s.setPickup);
  const setSheetIndex = useHomeStore((s) => s.setSheetIndex);
  const setEstimate = useHomeStore((s) => s.setEstimate);
  const setLoadingEstimate = useHomeStore((s) => s.setLoadingEstimate);
  const resetSelection = useHomeStore((s) => s.resetSelection);

  const setTrip = useRideStore((s) => s.setTrip);
  const requestRideAction = useRideStore((s) => s.requestRideAction);
  const resetRide = useRideStore((s) => s.resetRide);
  const rideStatus = useRideStore((s) => s.status);
  const rideId = useRideStore((s) => s.rideId);
  const requesting = useRideStore((s) => s.requesting);
  const passengerMode = useHomeStore((s) => s.passengerMode);
  const passenger = useHomeStore((s) => s.passenger);

  const bootstrapLocation = useHomeStore((s) => s.bootstrapLocation);

  useEffect(() => {
    void bootstrapLocation();
  }, [bootstrapLocation]);

  // Default the pickup to the device GPS fix, but only until the rider has made
  // an explicit selection. Live GPS updates must never overwrite a manual pickup.
  useEffect(() => {
    if (!pickup && location) {
      setPickup({ coordinates: location, address: null, source: "gps" });
      reverseGeocode(location)
        .then((addr) => {
          const current = useHomeStore.getState().pickup;
          if (current && current.source === "gps" && current.coordinates.latitude === location.latitude && current.coordinates.longitude === location.longitude) {
            useHomeStore.getState().setPickup({ coordinates: location, address: addr, source: "gps" });
          }
        })
        .catch(() => {});
    }
  }, [location, pickup, setPickup]);

  useActiveRideDiscovery(pathname === "/" && (rideStatus === "SEARCHING_DRIVER" || rideStatus === "REQUESTING"));

  // Route estimate: recompute whenever pickup or destination coordinates change.
  useEffect(() => {
    let active = true;
    const pickupCoords = pickup?.coordinates;
    const destCoords = destination?.coordinates;

    if (!pickupCoords || !destCoords) {
      setEstimate(null);
      return;
    }

    setLoadingEstimate(true);
    getRouteEstimate(pickupCoords, destCoords)
      .then((next) => {
        if (active) setEstimate(next);
      })
      .catch(() => {
        if (active) setEstimate(null);
      })
      .finally(() => {
        if (active) setLoadingEstimate(false);
      });

    return () => {
      active = false;
    };
  }, [pickup, destination, setEstimate, setLoadingEstimate]);

  const effectivePickupCoords = pickup?.coordinates ?? location;
  const destinationCoords = destination?.coordinates ?? null;

  const handleOpenLocationSelect = useCallback(
    (mode: "pickup" | "destination") => {
      router.push({ pathname: "/location-select" as never, params: { mode } } as never);
    },
    []
  );

  const handleRequestRide = useCallback(() => {
    if (requesting) {
      rideLog("RIDE_BUTTON_PRESSED_GUARDED", {
        userId: user?.id ?? null,
        hasPickup: !!effectivePickupCoords,
        hasDest: !!destinationCoords,
        hasEstimate: !!estimate,
        reason: "already requesting",
      });
      return;
    }
    if (!effectivePickupCoords || !destinationCoords || !estimate || !user) {
      rideLog("RIDE_BUTTON_PRESSED_GUARDED", {
        userId: user?.id ?? null,
        hasPickup: !!effectivePickupCoords,
        hasDest: !!destinationCoords,
        hasEstimate: !!estimate,
      });
      return;
    }

    // Untrusted display hint only; backend pricing engine recomputes the
    // authoritative fare at POST /rides/request and overwrites trip.fare.
    const fare = calculateRideFare(selectedOption, estimate.distance, estimate.duration);
    const isOther = passengerMode === "other" && passenger?.name?.trim() && passenger?.phone?.trim();

    rideLog("RIDE_BUTTON_PRESSED", {
      userId: user.id,
      vehicleType: selectedOption.vehicleType ?? selectedOption.label.toLowerCase(),
      fare,
      passengerMode,
    });

    setTrip({
      pickup: effectivePickupCoords,
      dropoff: destinationCoords,
      selectedOption,
      fare,
      distance: estimate.distance,
      duration: estimate.duration,
      path: estimate.path,
      pickupAddress: pickup?.address ?? null,
      dropAddress: destination?.address ?? null,
      passengerName: isOther ? passenger!.name.trim() : null,
      passengerPhone: isOther ? passenger!.phone.trim() : null,
    });

    requestRideAction(user.id, { navigateToTracking: false });
  }, [
    effectivePickupCoords,
    destinationCoords,
    estimate,
    selectedOption,
    setTrip,
    requestRideAction,
    user,
    requesting,
    passengerMode,
    passenger,
    pickup,
    destination?.address,
  ]);

  const handleCancelRide = useCallback(() => {
    rideLog("HOME_RIDE_CANCELLED", { rideId, userId: user?.id ?? null });
    if (rideId) {
      cancelRide(rideId).catch(() => {}).finally(() => resetRide());
    } else {
      resetRide();
    }
    resetSelection();
  }, [rideId, resetRide, user, resetSelection]);

  useEffect(() => {
    if (rideStatus === "DRIVER_ASSIGNED" && pathname === "/") {
      rideLog("NAVIGATION", { to: "/tracking", reason: "home.DRIVER_ASSIGNED effect", rideId, userId: user?.id ?? null });
      router.push("/tracking");
    }
  }, [rideStatus, rideId, user, pathname]);

  const snapPoints = useMemo(() => ["20%", "78%", "92%"], []);
  const avatarInitial = user?.full_name?.[0]?.toUpperCase() ?? "U";

  const mapAvailable = !!(location || pickup || destination);

  const world = useMemo(
    () => (
      <View style={styles.screen}>
        <FlowParallax progress={sheetIndex} factor={flowLayers.map} style={styles.mapLayer}>
          {mapAvailable ? (
            <RideMap location={effectivePickupCoords ?? { latitude: 0, longitude: 0 }} destinationCoords={destinationCoords} routePath={estimate?.path} />
          ) : (
            <View style={styles.mapPlaceholder}>
              {loadingLocation ? (
                <ActivityIndicator size="small" color="#111111" />
              ) : (
                <Text style={styles.mapPlaceholderIcon}>📍</Text>
              )}
              <Text style={styles.mapPlaceholderText}>
                {loadingLocation
                  ? "Finding your pickup point…"
                  : permissionDenied
                  ? "Location unavailable. You can still search or move the map to pick a spot."
                  : "Pick a location to start."}
              </Text>
            </View>
          )}
        </FlowParallax>

        <FlowParallax progress={sheetIndex} factor={flowLayers.controls} style={[styles.avatarWrap, { top: insets.top + 16, left: 20 }]}>
          <PressableScale scaleTo={0.96} onPress={presentProfile}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            </View>
          </PressableScale>
        </FlowParallax>

        <FlowParallax progress={sheetIndex} factor={flowLayers.controls} style={[styles.locationButtonWrap, { top: insets.top + 80 }]}>
          <PressableScale
            scaleTo={0.96}
            onPress={() => handleOpenLocationSelect("pickup")}
            style={styles.locationButton}
          >
            <Text style={styles.locationIcon}>📍</Text>
          </PressableScale>
        </FlowParallax>

        <BottomSheet
          ref={sheetRef}
          snapPoints={snapPoints}
          index={0}
          animatedIndex={sheetIndex}
          onChange={setSheetIndex}
          handleComponent={BottomSheetHandle}
          style={styles.sheetContainer}
          backgroundStyle={styles.sheetBackground}
          enablePanDownToClose={false}
          enableDynamicSizing={false}
          overDragResistanceFactor={0.1}
          keyboardBehavior="interactive"
        >
          <BottomSheetScrollView contentContainerStyle={styles.sheetScroll}>
            <BottomSheetContent
              onOpenLocationSelect={handleOpenLocationSelect}
              onRequestRide={handleRequestRide}
              onCancelRide={handleCancelRide}
            />
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
    ),
    [
      insets,
      sheetIndex,
      mapAvailable,
      effectivePickupCoords,
      destinationCoords,
      estimate,
      loadingLocation,
      permissionDenied,
      avatarInitial,
      handleOpenLocationSelect,
      handleRequestRide,
      handleCancelRide,
      snapPoints,
      setSheetIndex,
      presentProfile,
    ]
  );

  const layer = useMemo(() => <ProfileSurface onClose={dismissProfile} />, [dismissProfile]);

  return (
    <FlowView>
      <FlowSurface open={surfaceOpen} visible={surfaceVisible} world={world} layer={layer} />
    </FlowView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  mapLayer: { flex: 1 },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  mapPlaceholderIcon: { fontSize: 24 },
  mapPlaceholderText: {
    color: "#6B7280",
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    textAlign: "center",
    paddingHorizontal: 28,
  },
  avatarWrap: { position: "absolute", zIndex: 10 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 16, fontFamily: "GeneralSans-Bold", color: "#111111" },
  locationButtonWrap: { position: "absolute", right: 16, gap: 12, zIndex: 10 },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  locationIcon: { fontSize: 18 },
  sheetContainer: { marginHorizontal: 12, marginBottom: 16 },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  sheetScroll: { paddingBottom: 40 },
});
