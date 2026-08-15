import * as Location from "expo-location";
import { router, usePathname } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
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
import { ProfileSurface } from "./profile-screen";
import type { SearchResult } from "../../components/home/types";
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
  const selectedDestination = useHomeStore((s) => s.selectedDestination);
  const selectedPickup = useHomeStore((s) => s.selectedPickup);
  const estimate = useHomeStore((s) => s.estimate);
  const loadingEstimate = useHomeStore((s) => s.loadingEstimate);
  const selectedOption = useHomeStore((s) => s.selectedOption);
  const setSheetIndex = useHomeStore((s) => s.setSheetIndex);

  const setLocation = useHomeStore((s) => s.setLocation);
  const setPermissionDenied = useHomeStore((s) => s.setPermissionDenied);
  const setLoadingLocation = useHomeStore((s) => s.setLoadingLocation);
  const setIsRefreshingLocation = useHomeStore((s) => s.setIsRefreshingLocation);
  const setQuery = useHomeStore((s) => s.setQuery);
  const setResults = useHomeStore((s) => s.setResults);
  const setSelectedDestination = useHomeStore((s) => s.setSelectedDestination);
  const setEstimate = useHomeStore((s) => s.setEstimate);
  const setLoadingEstimate = useHomeStore((s) => s.setLoadingEstimate);

  const setTrip = useRideStore((s) => s.setTrip);
  const requestRideAction = useRideStore((s) => s.requestRideAction);
  const resetRide = useRideStore((s) => s.resetRide);
  const rideStatus = useRideStore((s) => s.status);
  const rideId = useRideStore((s) => s.rideId);
  const requesting = useRideStore((s) => s.requesting);

  // While the rider is on the home route and a ride is being searched for,
  // poll the backend for the active ride so DRIVER_ASSIGNED can be discovered
  // from the searching state itself (no reliance on the tracking screen being
  // mounted). Backend truth only — never invents a status.
  useActiveRideDiscovery(pathname === "/" && (rideStatus === "SEARCHING_DRIVER" || rideStatus === "REQUESTING"));

  const effectivePickupCoords = useMemo(() => {
    if (selectedPickup?.geometry?.coordinates) {
      return {
        latitude: selectedPickup.geometry.coordinates[1],
        longitude: selectedPickup.geometry.coordinates[0],
      };
    }
    return location;
  }, [selectedPickup, location]);

  const snapPoints = useMemo(() => ["20%", "78%", "92%"], []);

  const avatarInitial = user?.full_name?.[0]?.toUpperCase() ?? "U";

  const loadCurrentLocation = useCallback(
    async (showInitialLoader = false) => {
      if (showInitialLoader) setLoadingLocation(true);
      else setIsRefreshingLocation(true);

      const timeoutId = setTimeout(() => {
        setLoadingLocation(false);
        setIsRefreshingLocation(false);
      }, 10000);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setPermissionDenied(true);
          return;
        }

        let current = await Location.getLastKnownPositionAsync({});
        if (!current) {
          current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }

        setPermissionDenied(false);
        setLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
      } catch {
        setPermissionDenied(true);
      } finally {
        clearTimeout(timeoutId);
        setLoadingLocation(false);
        setIsRefreshingLocation(false);
      }
    },
    [setLocation, setPermissionDenied, setLoadingLocation, setIsRefreshingLocation],
  );

  useEffect(() => {
    loadCurrentLocation(true);
  }, [loadCurrentLocation]);

  const handleSelectDestination = useCallback(
    async (item: SearchResult, title: string) => {
      setSelectedDestination(item);
      setQuery(title);
      setResults([]);
    },
    [setSelectedDestination, setQuery, setResults],
  );

  useEffect(() => {
    let active = true;

    const coords = selectedDestination?.geometry?.coordinates;
    if (!effectivePickupCoords || !coords) {
      setEstimate(null);
      return;
    }

    setLoadingEstimate(true);

    const destinationCoords = { latitude: coords[1], longitude: coords[0] };

    getRouteEstimate(effectivePickupCoords, destinationCoords)
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
  }, [effectivePickupCoords, selectedDestination, setEstimate, setLoadingEstimate]);

  const destinationCoords = useMemo(() => {
    const coords = selectedDestination?.geometry?.coordinates;
    if (!coords) return null;
    return { latitude: coords[1], longitude: coords[0] };
  }, [selectedDestination]);

  const handleRequestRide = useCallback(() => {
    if (requesting) {
      rideLog("RIDE_BUTTON_PRESSED_GUARDED", { userId: user?.id ?? null, hasPickup: !!effectivePickupCoords, hasDest: !!destinationCoords, hasEstimate: !!estimate, reason: "already requesting" });
      return;
    }
    if (!effectivePickupCoords || !destinationCoords || !estimate || !user) {
      rideLog("RIDE_BUTTON_PRESSED_GUARDED", { userId: user?.id ?? null, hasPickup: !!effectivePickupCoords, hasDest: !!destinationCoords, hasEstimate: !!estimate });
      return;
    }

    const fare = calculateRideFare(selectedOption, estimate.distance, estimate.duration);

    rideLog("RIDE_BUTTON_PRESSED", { userId: user.id, vehicleType: selectedOption.vehicleType ?? selectedOption.label.toLowerCase(), fare });

    setTrip({
      pickup: effectivePickupCoords,
      dropoff: destinationCoords,
      selectedOption,
      fare,
      distance: estimate.distance,
      duration: estimate.duration,
      path: estimate.path,
    });

    requestRideAction(user.id, { navigateToTracking: false });
  }, [effectivePickupCoords, destinationCoords, estimate, selectedOption, setTrip, requestRideAction, user, requesting]);

  const handleCancelRide = useCallback(() => {
    rideLog("HOME_RIDE_CANCELLED", { rideId, userId: user?.id ?? null });
    if (rideId) {
      cancelRide(rideId).catch(() => {}).finally(() => resetRide());
    } else {
      resetRide();
    }
  }, [rideId, resetRide, user]);

  useEffect(() => {
    // Navigate to tracking once a real backend-driven assignment arrives while
    // the rider is still on the home route.
    if (rideStatus === "DRIVER_ASSIGNED" && pathname === "/") {
      rideLog("NAVIGATION", { to: "/tracking", reason: "home.DRIVER_ASSIGNED effect", rideId, userId: user?.id ?? null });
      rideLog("HOME_NAVIGATE_TO_TRACKING", { rideId, userId: user?.id ?? null });
      router.push("/tracking");
    }
  }, [rideStatus, rideId, user, pathname]);

  const world = useMemo(
    () => (
      <View style={styles.screen}>
        <FlowParallax progress={sheetIndex} factor={flowLayers.map} style={styles.mapLayer}>
          {location ? (
            <RideMap location={location} destinationCoords={destinationCoords} routePath={estimate?.path} />
          ) : null}
        </FlowParallax>

        <FlowParallax
          progress={sheetIndex}
          factor={flowLayers.controls}
          style={[styles.avatarWrap, { top: insets.top + 16, left: 20 }]}
        >
          <PressableScale scaleTo={0.96} onPress={presentProfile}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            </View>
          </PressableScale>
        </FlowParallax>

        <FlowParallax
          progress={sheetIndex}
          factor={flowLayers.controls}
          style={[styles.locationButtonWrap, { top: insets.top + 80 }]}
        >
          <Pressable style={styles.locationButton}>
            <Text style={styles.locationIcon}>📍</Text>
          </Pressable>
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
        >
          <BottomSheetScrollView contentContainerStyle={styles.sheetScroll}>
            <BottomSheetContent
              onSelectDestination={handleSelectDestination}
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
      location,
      destinationCoords,
      estimate,
      avatarInitial,
      handleSelectDestination,
      handleRequestRide,
      handleCancelRide,
      snapPoints,
      setSheetIndex,
      presentProfile,
    ]
  );

  const layer = useMemo(
    () => <ProfileSurface onClose={dismissProfile} />,
    [dismissProfile]
  );

  if (loadingLocation) {
    return (
      <FlowView>
        <View style={styles.centered}>
          <Text style={styles.loadingTitle}>Finding your pickup point</Text>
          <Text style={styles.loadingSubtitle}>
            We&apos;re setting up the rider home screen around your live location.
          </Text>
        </View>
      </FlowView>
    );
  }

  if (permissionDenied || !location) {
    return (
      <FlowView>
        <View style={[styles.centered, { paddingHorizontal: 28 }]}>
          <Text style={styles.loadingTitle}>Location access is needed</Text>
          <Text style={styles.loadingSubtitle}>
            Allow location permission to search destinations, estimate routes, and start the rider flow from home.
          </Text>
        </View>
      </FlowView>
    );
  }

  return (
    <FlowView>
      <FlowSurface
        open={surfaceOpen}
        visible={surfaceVisible}
        world={world}
        layer={layer}
      />
    </FlowView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  mapLayer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingTitle: {
    color: "#111111",
    fontSize: 28,
    fontFamily: "GeneralSans-Bold",
    textAlign: "center",
  },
  loadingSubtitle: {
    color: "#6B7280",
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    textAlign: "center",
    marginTop: 8,
  },
  avatarWrap: {
    position: "absolute",
    zIndex: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 16,
    fontFamily: "GeneralSans-Bold",
    color: "#111111",
  },
  locationButtonWrap: {
    position: "absolute",
    right: 16,
    gap: 12,
    zIndex: 10,
  },
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
  locationIcon: {
    fontSize: 18,
  },
  sheetContainer: {
    marginHorizontal: 12,
    marginBottom: 16,
  },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  sheetScroll: {
    paddingBottom: 40,
  },
});
