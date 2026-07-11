import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RideMap } from "../../components/Map/RideMap";
import { Header } from "../../components/Header";
import { BottomSheetHandle } from "../../components/BottomSheet/BottomSheetHandle";
import { BottomSheetContent } from "../../components/BottomSheet/BottomSheetContent";
import { useHomeStore } from "../../store/homeStore";
import { useRideStore } from "../../context/ride-store";
import { getRouteEstimate } from "../../services/osrm";
import { calculateRideFare } from "../../components/ride/ride-helpers";
import type { SearchResult } from "../../components/home/types";

export function RiderHomeScreen() {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);

  const location = useHomeStore((s) => s.location);
  const permissionDenied = useHomeStore((s) => s.permissionDenied);
  const loadingLocation = useHomeStore((s) => s.loadingLocation);
  const selectedDestination = useHomeStore((s) => s.selectedDestination);
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
  const resetDestination = useHomeStore((s) => s.resetDestination);

  const snapPoints = useMemo(() => ["18%", "45%", "90%"], []);

  const loadCurrentLocation = useCallback(
    async (showInitialLoader = false) => {
      if (showInitialLoader) {
        setLoadingLocation(true);
      } else {
        setIsRefreshingLocation(true);
      }

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
    if (!location || !coords) {
      setEstimate(null);
      return;
    }

    setLoadingEstimate(true);

    const destinationCoords = { latitude: coords[1], longitude: coords[0] };

    getRouteEstimate(location, destinationCoords)
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
  }, [location, selectedDestination, setEstimate, setLoadingEstimate]);

  const destinationCoords = useMemo(() => {
    const coords = selectedDestination?.geometry?.coordinates;
    if (!coords) return null;
    return { latitude: coords[1], longitude: coords[0] };
  }, [selectedDestination]);

  const setTrip = useRideStore((s) => s.setTrip);

  const handleRequestRide = useCallback(() => {
    if (!location || !destinationCoords || !estimate) return;

    const fare = calculateRideFare(selectedOption, estimate.distance, estimate.duration);

    setTrip({
      pickup: location,
      dropoff: destinationCoords,
      selectedOption,
      fare,
      distance: estimate.distance,
      duration: estimate.duration,
      path: estimate.path,
    });

    router.push("/confirm");
  }, [location, destinationCoords, estimate, selectedOption, setTrip]);

  const handleRefreshLocation = useCallback(() => {
    loadCurrentLocation(false);
  }, [loadCurrentLocation]);

  if (loadingLocation) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" }}>
        <Text
          style={{
            color: "#111111",
            fontSize: 28,
            fontFamily: "NeueMontreal-Bold",
            textAlign: "center",
          }}
        >
          Finding your pickup point
        </Text>
        <Text
          style={{
            color: "#6B7280",
            fontSize: 14,
            fontFamily: "NeueMontreal-Regular",
            textAlign: "center",
            marginTop: 8,
            paddingHorizontal: 28,
          }}
        >
          We&apos;re setting up the rider home screen around your live location.
        </Text>
      </View>
    );
  }

  if (permissionDenied || !location) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", paddingHorizontal: 28 }}>
        <Text style={{ color: "#111111", fontSize: 28, fontFamily: "NeueMontreal-Bold", textAlign: "center" }}>
          Location access is needed
        </Text>
        <Text style={{ color: "#6B7280", fontSize: 14, fontFamily: "NeueMontreal-Regular", textAlign: "center", marginTop: 8 }}>
          Allow location permission to search destinations, estimate routes, and start the rider flow from home.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <RideMap location={location} destinationCoords={destinationCoords} routePath={estimate?.path} />

      <Header />

      <View
        style={{
          position: "absolute",
          right: 16,
          top: insets.top + 80,
          gap: 12,
          zIndex: 10,
        }}
      >
        <Pressable
          onPress={() => {
            if (location) {
              // Center map on current location
            }
          }}
          style={{
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
          }}
        >
          <Text style={{ fontSize: 18 }}>📍</Text>
        </Pressable>
      </View>

      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        index={0}
        onChange={setSheetIndex}
        handleComponent={BottomSheetHandle}
        backgroundStyle={{
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 4,
        }}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        overDragResistanceFactor={0.1}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <BottomSheetContent
            onRefreshLocation={handleRefreshLocation}
            onSelectDestination={handleSelectDestination}
            onContinue={handleRequestRide}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
