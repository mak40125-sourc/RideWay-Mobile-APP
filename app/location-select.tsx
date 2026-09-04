import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { type Region } from "react-native-maps";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHomeStore } from "../store/homeStore";
import { reverseGeocode, searchDestinations, formatSearchResult } from "../services/places";
import type { Coordinates, LocationSource, SearchResult, SelectedLocation } from "../components/home/types";
import { PressableScale } from "../components/flow/PressableScale";

const MAP_SEARCH_DEBOUNCE_MS = 250;
const MAP_MOVE_DEBOUNCE_MS = 500;

export function LocationSelectScreen() {
  const params = useLocalSearchParams<{ mode?: string; lat?: string; lng?: string }>();
  const mode: "pickup" | "destination" = params.mode === "destination" ? "destination" : "pickup";
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const deviceLocation = useHomeStore((s) => s.location);
  const pickup = useHomeStore((s) => s.pickup);
  const destination = useHomeStore((s) => s.destination);
  const setPickup = useHomeStore((s) => s.setPickup);
  const setDestination = useHomeStore((s) => s.setDestination);
  const permissionDenied = useHomeStore((s) => s.permissionDenied);

  const mapRef = useRef<MapView>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [source, setSource] = useState<LocationSource>("map");
  const [region, setRegion] = useState<Region | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoFailed, setGeoFailed] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);

  // Resolve the initial center: explicit params > existing selection > device GPS.
  useEffect(() => {
    const latParam = params.lat ? parseFloat(params.lat) : NaN;
    const lngParam = params.lng ? parseFloat(params.lng) : NaN;
    if (Number.isFinite(latParam) && Number.isFinite(lngParam)) {
      const c = { latitude: latParam, longitude: lngParam };
      setCoords(c);
      setAddress(null);
      setSource("map");
      setRegion({ ...c, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      return;
    }

    const existing = mode === "pickup" ? pickup : destination;
    if (existing) {
      setCoords(existing.coordinates);
      setAddress(existing.address);
      setSource(existing.source);
      setRegion({ ...existing.coordinates, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      return;
    }

    if (deviceLocation) {
      setCoords(deviceLocation);
      setSource("gps");
      setRegion({ ...deviceLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse geocode the initial coordinates once the map is centered.
  useEffect(() => {
    if (coords && !address) {
      setGeocoding(true);
      reverseGeocode(coords)
        .then((addr) => {
          setAddress(addr);
          setGeoFailed(!addr);
        })
        .finally(() => setGeocoding(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegionChangeComplete = (r: Region) => {
    const next: Coordinates = { latitude: r.latitude, longitude: r.longitude };
    if (moveDebounce.current) clearTimeout(moveDebounce.current);
    moveDebounce.current = setTimeout(() => {
      setCoords(next);
      setSource("map");
      setGeocoding(true);
      setGeoFailed(false);
      reverseGeocode(next)
        .then((addr) => {
          setAddress(addr);
          setGeoFailed(!addr);
        })
        .finally(() => setGeocoding(false));
    }, MAP_MOVE_DEBOUNCE_MS);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (value.trim().length < 3) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const matches = await searchDestinations(value);
        setResults(matches);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, MAP_SEARCH_DEBOUNCE_MS);
  };

  const selectSearchResult = async (item: SearchResult) => {
    const c = item.geometry?.coordinates;
    if (!c) return;
    const next: Coordinates = { latitude: c[1], longitude: c[0] };
    setCoords(next);
    setSource("search");
    setQuery("");
    setResults([]);
    mapRef.current?.animateToRegion({ ...next, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
    setGeocoding(true);
    setGeoFailed(false);
    const addr = await reverseGeocode(next).catch(() => null);
    setAddress(addr ?? formatSearchResult(item).title);
    setGeoFailed(!addr);
    setGeocoding(false);
  };

  const useMyLocation = async () => {
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        useHomeStore.getState().setPermissionDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next: Coordinates = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(next);
      setSource("gps");
      mapRef.current?.animateToRegion({ ...next, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
      setGeocoding(true);
      setGeoFailed(false);
      const addr = await reverseGeocode(next).catch(() => null);
      setAddress(addr);
      setGeoFailed(!addr);
    } catch {
      useHomeStore.getState().setPermissionDenied(true);
    } finally {
      setGeocoding(false);
      setGpsBusy(false);
    }
  };

  const handleConfirm = () => {
    if (!coords) return;
    const selected: SelectedLocation = {
      coordinates: coords,
      address,
      source,
    };
    if (mode === "pickup") setPickup(selected);
    else setDestination(selected);
    router.back();
  };

  const title = mode === "pickup" ? "Set pickup location" : "Set destination";

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1 }}>
        {region ? (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={region}
            onRegionChangeComplete={handleRegionChangeComplete}
            scrollEnabled
            zoomEnabled
            rotateEnabled
            pitchEnabled
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: "#F7F7F7", alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color="#111111" />
            <Text style={{ color: "#6B7280", marginTop: 10, fontFamily: "GeneralSans-Regular" }}>
              {permissionDenied ? "Location unavailable" : "Locating…"}
            </Text>
          </View>
        )}

        {/* Fixed center pin — the map moves underneath it. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 180,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 38 }}>📍</Text>
        </View>

        {/* Top bar: back + mode title + search */}
        <View
          style={{
            position: "absolute",
            top: insets.top + 12,
            left: 16,
            right: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <PressableScale scaleTo={0.96} onPress={() => router.back()} style={topButton}>
              <Text style={{ fontSize: 18 }}>←</Text>
            </PressableScale>
            <View style={topButton}>
              <Text style={{ color: "#111111", fontSize: 15, fontFamily: "GeneralSans-Bold" }}>{title}</Text>
            </View>
          </View>

          <View style={searchBox}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={{ flex: 1, color: "#111111", fontSize: 15, fontFamily: "GeneralSans-Regular" }}
              placeholder={mode === "pickup" ? "Search pickup" : "Search destination"}
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={handleQueryChange}
            />
            {isSearching && <ActivityIndicator size="small" color="#111111" />}
          </View>

          {results.length > 0 && (
            <View style={resultsBox}>
              {results.slice(0, 6).map((item, i) => {
                const { title: t, subtitle } = formatSearchResult(item);
                return (
                  <PressableScale
                    key={`r-${i}`}
                    onPress={() => selectSearchResult(item)}
                    style={resultRow}
                  >
                    <Text style={{ color: "#111111", fontSize: 15, fontFamily: "GeneralSans-Bold" }}>{t}</Text>
                    {subtitle ? (
                      <Text style={{ color: "#6B7280", fontSize: 12, fontFamily: "GeneralSans-Regular", marginTop: 2 }}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </PressableScale>
                );
              })}
            </View>
          )}
        </View>

        {/* "Use my location" quick action */}
        <PressableScale
          scaleTo={0.96}
          onPress={useMyLocation}
          style={[useLocationButton, { top: insets.top + 12, right: 16 }]}
        >
          <Text style={{ fontSize: 18 }}>📍</Text>
        </PressableScale>
      </View>

      {/* Bottom sheet: selected address + confirm */}
      <View style={bottomSheet}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 12 }} />
        <Text style={{ color: "#6B7280", fontSize: 11, fontFamily: "GeneralSans-Bold", letterSpacing: 1.2, textTransform: "uppercase" }}>
          {mode === "pickup" ? "Pickup" : "Destination"}
        </Text>
        <Text style={{ color: "#111111", fontSize: 18, fontFamily: "GeneralSans-Bold", marginTop: 4 }} numberOfLines={2}>
          {geocoding ? "Finding address…" : address ?? "Move the map to set location"}
        </Text>
        {geoFailed && !geocoding ? (
          <Text style={{ color: "#DC2626", fontSize: 12, fontFamily: "GeneralSans-Regular", marginTop: 4 }}>
            Couldn’t fetch the address — coordinates still selected.
          </Text>
        ) : null}

        <PressableScale
          scaleTo={0.97}
          disabled={!coords || geocoding}
          onPress={handleConfirm}
          style={[
            confirmButton,
            { backgroundColor: !coords || geocoding ? "#9CA3AF" : "#111111" },
          ]}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontFamily: "GeneralSans-Bold" }}>
            {gpsBusy ? "Locating…" : mode === "pickup" ? "Confirm pickup" : "Confirm destination"}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const topButton: any = {
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
};

const searchBox: any = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  paddingHorizontal: 16,
  height: 52,
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 4,
};

const resultsBox: any = {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  padding: 8,
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 4,
};

const resultRow: any = {
  paddingVertical: 10,
  paddingHorizontal: 8,
  borderBottomWidth: 1,
  borderBottomColor: "#F3F4F6",
};

const useLocationButton: any = {
  position: "absolute",
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
};

const bottomSheet: any = {
  position: "absolute",
  left: 12,
  right: 12,
  bottom: 16,
  backgroundColor: "#FFFFFF",
  borderRadius: 24,
  padding: 20,
  shadowColor: "#000",
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 8,
};

const confirmButton: any = {
  height: 56,
  borderRadius: 18,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 16,
};

export default function LocationSelectRoute() {
  return <LocationSelectScreen />;
}
