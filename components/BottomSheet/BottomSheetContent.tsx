import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useHomeStore } from "../../store/homeStore";
import { SearchBar } from "../SearchBar";
import { PickupCard } from "../PickupCard";
import { calculateRideFare } from "../ride/ride-helpers";
import { rideOptions } from "../ride/ride-config";
import { searchDestinations } from "../../services/places";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import type { SearchResult } from "../home/types";

type Props = {
  onRefreshLocation: () => void;
  onSelectDestination: (item: SearchResult, title: string) => void;
  onContinue: () => void;
};

export function BottomSheetContent({ onRefreshLocation, onSelectDestination, onContinue }: Props) {
  const query = useHomeStore((s) => s.query);
  const setQuery = useHomeStore((s) => s.setQuery);
  const results = useHomeStore((s) => s.results);
  const setResults = useHomeStore((s) => s.setResults);
  const isSearching = useHomeStore((s) => s.isSearching);
  const setIsSearching = useHomeStore((s) => s.setIsSearching);
  const selectedDestination = useHomeStore((s) => s.selectedDestination);
  const estimate = useHomeStore((s) => s.estimate);
  const loadingEstimate = useHomeStore((s) => s.loadingEstimate);
  const selectedOption = useHomeStore((s) => s.selectedOption);
  const setSelectedOption = useHomeStore((s) => s.setSelectedOption);
  const sheetIndex = useHomeStore((s) => s.sheetIndex);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tripMinutes = estimate ? Math.max(1, Math.round(estimate.duration)) : 0;
  const dropTime = new Date(Date.now() + tripMinutes * 60 * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const matches = await searchDestinations(query);
        setResults(matches);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const getOptionMeta = (label: string) => {
    const n = label.toLowerCase();
    if (n.includes("bike") || n.includes("dash")) return { icon: "BK", eta: "2 min away" };
    if (n.includes("auto")) return { icon: "AU", eta: "3 min away" };
    if (n.includes("premium") || n.includes("comfort")) return { icon: "PR", eta: "5 min away" };
    if (n.includes("mega") || n.includes("xl")) return { icon: "XL", eta: "6 min away" };
    return { icon: "CB", eta: "4 min away" };
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 4 }}>
      <Text
        style={{
          color: "#6B7280",
          fontSize: 11,
          fontFamily: "NeueMontreal-Bold",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        START YOUR TRIP
      </Text>

      <Text
        style={{
          color: "#111111",
          fontSize: 26,
          lineHeight: 30,
          fontFamily: "NeueMontreal-Bold",
          marginBottom: 16,
        }}
      >
        Where to?
      </Text>

      <SearchBar />

      {!selectedDestination && (
        <View style={{ marginTop: 12 }}>
          <PickupCard onRefreshLocation={onRefreshLocation} />

          {isSearching && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
              <ActivityIndicator size="small" color="#111111" />
              <Text style={{ color: "#6B7280", fontSize: 14, fontFamily: "NeueMontreal-Regular" }}>
                Searching places near you
              </Text>
            </View>
          )}

          <FlatList
            data={results}
            keyExtractor={(_, i) => `r-${i}`}
            scrollEnabled={false}
            style={{ marginTop: 8 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            ListEmptyComponent={
              query.trim().length >= 3 ? (
                <Text style={{ color: "#6B7280", fontSize: 14, fontFamily: "NeueMontreal-Regular", paddingTop: 8 }}>
                  No matching destinations yet. Try a nearby landmark or area.
                </Text>
              ) : null
            }
            renderItem={({ item }) => {
              const title = item.properties?.name || "Selected destination";
              const subtitle = [item.properties?.city || item.properties?.state, item.properties?.country]
                .filter(Boolean)
                .join(", ");
              return (
                <Pressable
                  onPress={() => onSelectDestination(item, title)}
                  style={({ pressed }) => ({
                    backgroundColor: "#FFFFFF",
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: "#111111", fontSize: 16, fontFamily: "NeueMontreal-Bold" }}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={{ color: "#6B7280", fontSize: 14, fontFamily: "NeueMontreal-Regular", marginTop: 4 }}>
                      {subtitle}
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {(sheetIndex >= 1 || selectedDestination) && selectedDestination && (
        <View style={{ marginTop: 16 }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text
              style={{
                color: "#6B7280",
                fontSize: 11,
                fontFamily: "NeueMontreal-Bold",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Destination
            </Text>
            <Text style={{ color: "#111111", fontSize: 18, fontFamily: "NeueMontreal-Bold" }}>
              {selectedDestination?.properties?.name || "Selected"}
            </Text>
          </View>
        </View>
      )}

      {loadingEstimate && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14 }}>
          <ActivityIndicator size="small" color="#111111" />
          <Text style={{ color: "#6B7280", fontSize: 14, fontFamily: "NeueMontreal-Regular" }}>
            Calculating route and travel time
          </Text>
        </View>
      )}

      {estimate && (
        <View style={{ marginTop: 12 }}>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: "#111111", fontSize: 18, fontFamily: "NeueMontreal-Bold" }}>
              Choose a ride
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "NeueMontreal-Regular", marginTop: 2 }}>
              {estimate.distance.toFixed(1)} km - {tripMinutes} mins
            </Text>
          </View>

          {rideOptions.map((option) => {
            const isSelected = selectedOption.label === option.label;
            const fare = calculateRideFare(option, estimate.distance, estimate.duration);
            const meta = getOptionMeta(option.label);
            return (
              <Pressable
                key={option.label}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedOption(option);
                }}
                style={({ pressed }) => ({
                  backgroundColor: "#FFFFFF",
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? "#111111" : "#E5E7EB",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: "#F5F5F5",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#111111", fontSize: 12, fontFamily: "NeueMontreal-Bold" }}>
                      {meta.icon}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#111111", fontSize: 16, fontFamily: "NeueMontreal-Bold" }}>
                      {option.label}
                    </Text>
                    <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "NeueMontreal-Regular", marginTop: 2 }}>
                      {meta.eta} - Drop {dropTime}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: "#111111", fontSize: 18, fontFamily: "NeueMontreal-Bold", marginLeft: 12 }}>
                  Rs {fare}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onContinue();
            }}
            style={({ pressed }) => ({
              backgroundColor: "#111111",
              borderRadius: 18,
              paddingVertical: 15,
              alignItems: "center",
              marginTop: 8,
              marginBottom: 16,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 16,
                fontFamily: "NeueMontreal-Bold",
              }}
            >
              Find Ride - {selectedOption.label} Rs{" "}
              {calculateRideFare(selectedOption, estimate.distance, estimate.duration)}
            </Text>
          </Pressable>
        </View>
      )}

      {sheetIndex >= 2 && !selectedDestination && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: "#6B7280", fontSize: 14, fontFamily: "NeueMontreal-Regular", textAlign: "center" }}>
            Saved places and ride suggestions will appear here
          </Text>
        </View>
      )}
    </View>
  );
}
