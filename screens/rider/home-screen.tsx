import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native";

import { HomeHeader } from "../../components/home/home-header";
import { HomeMap } from "../../components/home/home-map";
import { HomeSearchSheet } from "../../components/home/home-search-sheet";
import { HomeStateScreen } from "../../components/home/home-state-screen";
import { homeStyles as styles } from "../../components/home/home-styles";
import type { Coordinates, RideEstimate, RideOption, SearchResult } from "../../components/home/types";
import { rideOptions } from "../../components/ride/ride-config";
import { calculateRideFare } from "../../components/ride/ride-helpers";
import { useAuth } from "../../context/auth-context";
import { getRouteEstimate } from "../../services/osrm";
import { searchDestinations } from "../../services/places";
import { buildMapRegion } from "../../utils/map-region";

export function RiderHomeScreen() {
  const { authUser } = useAuth();
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<SearchResult | null>(null);
  const [estimate, setEstimate] = useState<RideEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [selectedOption, setSelectedOption] = useState<RideOption>(rideOptions[0]);

  const loadCurrentLocation = async (showInitialLoader = false) => {
    if (showInitialLoader) {
      setLoadingLocation(true);
    } else {
      setIsRefreshingLocation(true);
    }
    
    // Safety timeout: If location takes more than 10 seconds, fail gracefully
    const timeoutId = setTimeout(() => {
      if (loadingLocation) setLoadingLocation(false);
      setIsRefreshingLocation(false);
    }, 10000);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setPermissionDenied(true);
        return;
      }

      // Try to get last known position first (it's nearly instant)
      let current = await Location.getLastKnownPositionAsync({});
      
      // Fallback to current position if last known is unavailable
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
    } catch (err) {
      console.warn("Location error:", err);
      setPermissionDenied(true);
    } finally {
      clearTimeout(timeoutId);
      if (showInitialLoader) {
        setLoadingLocation(false);
      } else {
        setIsRefreshingLocation(false);
      }
    }
  };

  useEffect(() => {
    void loadCurrentLocation(true);
  }, []);

  useEffect(() => {
    let active = true;

    const runSearch = async () => {
      if (query.trim().length < 3) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const matches = await searchDestinations(query);

        if (active) {
          setResults(matches);
        }
      } catch {
        if (active) {
          setResults([]);
        }
      } finally {
        if (active) {
          setIsSearching(false);
        }
      }
    };

    const timeout = setTimeout(runSearch, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    let active = true;

    const loadEstimate = async () => {
      const destinationCoords = selectedDestination?.geometry?.coordinates;

      if (!location || !destinationCoords) {
        setEstimate(null);
        return;
      }

      setLoadingEstimate(true);

      try {
        const nextEstimate = await getRouteEstimate(location, {
          latitude: destinationCoords[1],
          longitude: destinationCoords[0],
        });

        if (active) {
          setEstimate(nextEstimate);
        }
      } catch {
        if (active) {
          setEstimate(null);
        }
      } finally {
        if (active) {
          setLoadingEstimate(false);
        }
      }
    };

    void loadEstimate();

    return () => {
      active = false;
    };
  }, [location, selectedDestination]);

  const destinationCoords = useMemo(() => {
    const coords = selectedDestination?.geometry?.coordinates;

    if (!coords) {
      return null;
    }

    return {
      latitude: coords[1],
      longitude: coords[0],
    };
  }, [selectedDestination]);

  const region = useMemo(() => {
    if (!location) {
      return undefined;
    }

    return buildMapRegion(location, destinationCoords);
  }, [destinationCoords, location]);

  const destinationLabel = useMemo(() => {
    const properties = selectedDestination?.properties;

    if (!properties) {
      return "";
    }

    return [properties.name, properties.city || properties.state, properties.country]
      .filter(Boolean)
      .join(", ");
  }, [selectedDestination]);

  const locationLabel = useMemo(() => {
    if (!location) {
      return permissionDenied ? "Location permission required" : "Current location unavailable";
    }

    return `Lat ${location.latitude.toFixed(4)}, Lng ${location.longitude.toFixed(4)}`;
  }, [location, permissionDenied]);

  const currentFare = useMemo(() => {
    if (!estimate) return 0;
    return calculateRideFare(selectedOption, estimate.distance, estimate.duration);
  }, [estimate, selectedOption]);

  const requestRide = () => {
    if (!location || !destinationCoords || !estimate) {
      return;
    }

    router.push({
      pathname: "/confirm",
      params: {
        pickupLat: String(location.latitude),
        pickupLng: String(location.longitude),
        dropLat: String(destinationCoords.latitude),
        dropLng: String(destinationCoords.longitude),
        rideLabel: selectedOption.label,
        rideDescription: selectedOption.description,
        fare: String(currentFare),
        distance: String(estimate.distance),
        duration: String(estimate.duration),
        path: JSON.stringify(estimate.path),
      },
    });
  };

  // Guard against crashes if authUser is missing during transition
  if (!authUser) {
    return null;
  }

  if (loadingLocation) {
    return (
      <HomeStateScreen
        loading
        title="Finding your pickup point"
        description="We&apos;re setting up the rider home screen around your live location."
      />
    );
  }

  if (permissionDenied || !location || !region) {
    return (
      <HomeStateScreen
        title="Location access is needed"
        description="Allow location permission to search destinations, estimate routes, and start the rider flow from home."
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HomeMap
        location={location}
        destinationCoords={destinationCoords}
        region={region}
        routePath={estimate?.path}
      />
      <HomeHeader />
      <HomeSearchSheet
        query={query}
        setQuery={setQuery}
        results={results}
        isSearching={isSearching}
        selectedDestination={selectedDestination}
        destinationLabel={destinationLabel}
        loadingEstimate={loadingEstimate}
        estimate={estimate}
        locationLabel={locationLabel}
        isRefreshingLocation={isRefreshingLocation}
        rideOptions={rideOptions}
        selectedOptionLabel={selectedOption.label}
        onSelectOption={(option) => setSelectedOption(option)}
        currentFare={currentFare}
        onRefreshLocation={() => {
          void loadCurrentLocation(false);
        }}
        onSelectDestination={(item, title) => {
          setSelectedDestination(item);
          setQuery(title);
          setResults([]);
        }}
        onResetDestination={() => {
          setSelectedDestination(null);
          setEstimate(null);
          setQuery("");
        }}
        onContinue={requestRide}
      />
    </SafeAreaView>
  );
}
