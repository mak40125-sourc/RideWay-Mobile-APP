import { useEffect, useRef } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { useHomeStore } from "../../store/homeStore";
import { useRideStore } from "../../context/ride-store";
import { SearchBar } from "../SearchBar";
import { PickupCard } from "../PickupCard";
import { AnimatedSection } from "./AnimatedSection";
import { FlowSheet } from "../flow/FlowSheet";
import { PressableScale } from "../flow/PressableScale";
import { flowTiming } from "../../constants/flow-motion";
import { calculateRideFare } from "../ride/ride-helpers";
import { RIDE_ICON_ASSETS, rideOptions } from "../ride/ride-config";
import { searchDestinations } from "../../services/places";
import { rideLog } from "../../utils/ride-request-diagnostics";
import type { SearchResult } from "../home/types";

type Props = {
  onSelectDestination: (item: SearchResult, title: string) => void;
  onRequestRide: () => void;
  onCancelRide: () => void;
};

function buildLocationResult(label: string): SearchResult {
  return {
    properties: { name: label, city: "", state: "", country: "" },
  };
}

const recentPlaces = [
  { label: "Home", icon: "🏠" },
  { label: "Work", icon: "💼" },
  { label: "ISBT Sector 43", icon: "🚌" },
];

export function BottomSheetContent({ onSelectDestination, onRequestRide, onCancelRide }: Props) {
  const query = useHomeStore((s) => s.query);
  const setQuery = useHomeStore((s) => s.setQuery);
  const results = useHomeStore((s) => s.results);
  const setResults = useHomeStore((s) => s.setResults);
  const isSearching = useHomeStore((s) => s.isSearching);
  const setIsSearching = useHomeStore((s) => s.setIsSearching);
  const selectedDestination = useHomeStore((s) => s.selectedDestination);
  const setSelectedDestination = useHomeStore((s) => s.setSelectedDestination);
  const resetDestination = useHomeStore((s) => s.resetDestination);
  const estimate = useHomeStore((s) => s.estimate);
  const setEstimate = useHomeStore((s) => s.setEstimate);
  const loadingEstimate = useHomeStore((s) => s.loadingEstimate);
  const selectedOption = useHomeStore((s) => s.selectedOption);
  const setSelectedOption = useHomeStore((s) => s.setSelectedOption);

  const searchMode = useHomeStore((s) => s.searchMode);
  const setSearchMode = useHomeStore((s) => s.setSearchMode);
  const pickupQuery = useHomeStore((s) => s.pickupQuery);
  const setPickupQuery = useHomeStore((s) => s.setPickupQuery);
  const pickupResults = useHomeStore((s) => s.pickupResults);
  const setPickupResults = useHomeStore((s) => s.setPickupResults);
  const isSearchingPickup = useHomeStore((s) => s.isSearchingPickup);
  const setIsSearchingPickup = useHomeStore((s) => s.setIsSearchingPickup);
  const selectedPickup = useHomeStore((s) => s.selectedPickup);
  const setSelectedPickup = useHomeStore((s) => s.setSelectedPickup);

  const status = useRideStore((s) => s.status);
  const requesting = useRideStore((s) => s.requesting);
  const trip = useRideStore((s) => s.trip);
  const rideError = useRideStore((s) => s.error);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Destination search debounce
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
  }, [query, setResults, setIsSearching]);

  // Pickup search debounce
  useEffect(() => {
    if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    if (pickupQuery.trim().length < 3) {
      setPickupResults([]);
      setIsSearchingPickup(false);
      return;
    }
    setIsSearchingPickup(true);
    pickupDebounceRef.current = setTimeout(async () => {
      try {
        const matches = await searchDestinations(pickupQuery);
        setPickupResults(matches);
      } catch {
        setPickupResults([]);
      } finally {
        setIsSearchingPickup(false);
      }
    }, 250);
    return () => {
      if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    };
  }, [pickupQuery, setPickupResults, setIsSearchingPickup]);

  const isPickupMode = searchMode === "pickup";
  const showDestSearchResults = !isPickupMode && !selectedDestination && results.length > 0;
  const showDestOptions = !isPickupMode && !!selectedDestination && !requesting && status !== "SEARCHING_DRIVER" && status !== "DRIVER_ASSIGNED";
  const showBooking = !isPickupMode && (status === "SEARCHING_DRIVER" || status === "REQUESTING" || requesting);
  const showRecentPlaces = !isPickupMode && !selectedDestination && query.trim().length < 3 && !results.length;

  const pickupLabel = selectedPickup?.properties?.name || "Current Location";

  const getOptionMeta = (label: string) => {
    const n = label.toLowerCase();
    if (n.includes("bike") || n.includes("dash")) return { icon: "BK", eta: "2 min away" };
    if (n.includes("auto")) return { icon: "AU", eta: "3 min away" };
    if (n.includes("premium") || n.includes("comfort")) return { icon: "PR", eta: "5 min away" };
    if (n.includes("mega") || n.includes("xl")) return { icon: "XL", eta: "6 min away" };
    return { icon: "CB", eta: "4 min away" };
  };

  const tripMinutes = estimate ? Math.max(1, Math.round(estimate.duration)) : 0;
  const dropTime = new Date(Date.now() + tripMinutes * 60 * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const bookingVehicle = trip?.option?.label || selectedOption.label;
  const bookingFare = trip?.fare || calculateRideFare(selectedOption, estimate?.distance || 0, estimate?.duration || 0);

  const phase = isPickupMode
    ? "pickup"
    : showBooking
    ? "booking"
    : showDestOptions
    ? "options"
    : "search";

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, minHeight: 350 }}>
      {!isPickupMode && !showBooking && (
        <Text
          style={{
            color: "#111111",
            fontSize: 28,
            lineHeight: 32,
            fontFamily: "GeneralSans-Bold",
            marginBottom: 16,
          }}
        >
          Where to?
        </Text>
      )}

      {isPickupMode && (
        <Text
          style={{
            color: "#111111",
            fontSize: 24,
            lineHeight: 28,
            fontFamily: "GeneralSans-Bold",
            marginBottom: 16,
            paddingRight: 52,
          }}
        >
          Pickup location
        </Text>
      )}

      {isPickupMode ? (
        <SearchBar
          value={pickupQuery}
          onChangeText={setPickupQuery}
          placeholder="Search pickup location"
        />
      ) : (
        <SearchBar />
      )}

      {!isPickupMode && !showBooking && (
        <View style={{ marginTop: 12 }}>
          <PickupCard label={pickupLabel} onPress={() => setSearchMode("pickup")} />
        </View>
      )}

      <FlowSheet state={phase} duration={flowTiming.base}>
      <FlowSheet.Pane name="pickup">
      {/* Pickup search content */}
      {isPickupMode && (
        <View style={{ marginTop: 12 }}>
          {/* Current Location option */}
          <AnimatedSection visible={isPickupMode} delay={0}>
            <PressableScale
              onPress={() => {
                setSelectedPickup(null);
                setPickupQuery("");
                setPickupResults([]);
                setSearchMode("destination");
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingVertical: 14,
                paddingHorizontal: 4,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#E8E8E8",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 14 }}>📍</Text>
              </View>
              <Text
                style={{
                  color: "#111111",
                  fontSize: 15,
                  fontFamily: "GeneralSans-Bold",
                  flex: 1,
                }}
              >
                Current Location
              </Text>
            </PressableScale>
          </AnimatedSection>

          {isSearchingPickup && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <ActivityIndicator size="small" color="#111111" />
              <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular" }}>
                Searching places near you
              </Text>
            </View>
          )}

          {pickupResults.length > 0 && (
            <View style={{ marginTop: 8, gap: 10 }}>
              {pickupResults.slice(0, 6).map((item, i) => {
                const title = item.properties?.name || "Selected location";
                const subtitle = [item.properties?.city || item.properties?.state, item.properties?.country]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <AnimatedSection key={`pickup-${i}`} visible={isPickupMode} delay={i * 25}>
                    <PressableScale
                      onPress={() => {
                        setSelectedPickup(item);
                        setPickupQuery(title);
                        setPickupResults([]);
                        setSearchMode("destination");
                      }}
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                      }}
                    >
                      <Text style={{ color: "#111111", fontSize: 16, fontFamily: "GeneralSans-Bold" }}>
                        {title}
                      </Text>
                      {subtitle ? (
                        <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular", marginTop: 4 }}>
                          {subtitle}
                        </Text>
                      ) : null}
                    </PressableScale>
                  </AnimatedSection>
                );
              })}
            </View>
          )}

          {pickupQuery.trim().length >= 3 && pickupResults.length === 0 && !isSearchingPickup && (
            <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular", paddingTop: 12 }}>
              No matching locations found.
            </Text>
          )}
        </View>
      )}
      </FlowSheet.Pane>

      <FlowSheet.Pane name="search">
      {/* Destination search results */}
      {showDestSearchResults && (
        <View style={{ marginTop: 12, gap: 10 }}>
          {results.slice(0, 6).map((item, i) => {
            const title = item.properties?.name || "Selected destination";
            const subtitle = [item.properties?.city || item.properties?.state, item.properties?.country]
              .filter(Boolean)
              .join(", ");
            return (
              <AnimatedSection key={`result-${i}`} visible={true} delay={i * 25}>
                <PressableScale
                  onPress={() => onSelectDestination(item, title)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                  }}
                >
                  <Text style={{ color: "#111111", fontSize: 16, fontFamily: "GeneralSans-Bold" }}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular", marginTop: 4 }}>
                      {subtitle}
                    </Text>
                  ) : null}
                </PressableScale>
              </AnimatedSection>
            );
          })}
        </View>
      )}

      {!selectedDestination && query.trim().length >= 3 && results.length === 0 && !isSearching && (
        <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular", paddingTop: 12 }}>
          No matching destinations yet. Try a nearby landmark or area.
        </Text>
      )}

      {/* Recent places */}
      {showRecentPlaces && (
        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              color: "#6B7280",
              fontSize: 11,
              fontFamily: "GeneralSans-Bold",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Recent Places
          </Text>
          <View style={{ gap: 6 }}>
            {recentPlaces.map((place) => (
              <PressableScale
                key={place.label}
                onPress={() => onSelectDestination(buildLocationResult(place.label), place.label)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ fontSize: 16 }}>{place.icon}</Text>
                <Text
                  style={{
                    color: "#111111",
                    fontSize: 15,
                    fontFamily: "GeneralSans-Regular",
                  }}
                >
                  {place.label}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>
      )}
      </FlowSheet.Pane>

      <FlowSheet.Pane name="options">
      {/* Destination summary + ride options */}
      {showDestOptions && selectedDestination && (
        <View style={{ marginTop: 16 }}>
          <AnimatedSection visible={showDestOptions} delay={0}>
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: "#6B7280",
                      fontSize: 11,
                      fontFamily: "GeneralSans-Bold",
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Destination
                  </Text>
                  <Text style={{ color: "#111111", fontSize: 18, fontFamily: "GeneralSans-Bold" }}>
                    {selectedDestination?.properties?.name || "Selected"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => resetDestination()}
                  style={{ padding: 4, marginLeft: 8 }}
                >
                  <Text style={{ color: "#6B7280", fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
            </View>
          </AnimatedSection>

          {loadingEstimate && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14 }}>
              <ActivityIndicator size="small" color="#111111" />
              <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular" }}>
                Calculating route and travel time
              </Text>
            </View>
          )}

          {estimate && (
            <>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: "#111111", fontSize: 18, fontFamily: "GeneralSans-Bold" }}>
                  Choose a ride
                </Text>
                <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular", marginTop: 2 }}>
                  {estimate.distance.toFixed(1)} km - {tripMinutes} mins
                </Text>
              </View>

              {rideOptions.map((option, i) => {
                const isSelected = selectedOption.label === option.label;
                const fare = calculateRideFare(option, estimate.distance, estimate.duration);
                const meta = getOptionMeta(option.label);
                const iconSource = RIDE_ICON_ASSETS[option.vehicleType];
                return (
                  <AnimatedSection key={option.label} visible={showDestOptions} delay={i * 40}>
                    <PressableScale
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedOption(option);
                      }}
                      style={{
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
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            backgroundColor: "#F5F5F5",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {iconSource ? (
                            <Image source={iconSource} style={{ width: 44, height: 44, resizeMode: "contain" }} />
                          ) : (
                            <Text style={{ color: "#111111", fontSize: 12, fontFamily: "GeneralSans-Bold" }}>
                              {meta.icon}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#111111", fontSize: 16, fontFamily: "GeneralSans-Bold" }}>
                            {option.label}
                          </Text>
                          <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular", marginTop: 2 }}>
                            {meta.eta} - Drop {dropTime}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: "#111111", fontSize: 18, fontFamily: "GeneralSans-Bold", marginLeft: 12 }}>
                        Rs {fare}
                      </Text>
                    </PressableScale>
                  </AnimatedSection>
                );
              })}

              <PressableScale
                disabled={requesting}
                onPress={() => {
                  rideLog("FIND_RIDE_PRESSED", { status, requesting, hasTrip: !!trip });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onRequestRide();
                }}
                style={{
                  backgroundColor: requesting ? "#6B7280" : "#111111",
                  borderRadius: 18,
                  height: 56,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 8,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontFamily: "GeneralSans-Bold",
                  }}
                >
                  Find Ride - {selectedOption.label} Rs {calculateRideFare(selectedOption, estimate.distance, estimate.duration)}
                </Text>
              </PressableScale>

              {rideError && (
                <Text
                  style={{
                    color: "#DC2626",
                    fontSize: 13,
                    fontFamily: "GeneralSans-Regular",
                    textAlign: "center",
                    marginTop: -8,
                    marginBottom: 4,
                  }}
                >
                  {rideError}
                </Text>
              )}
            </>
          )}
        </View>
      )}
      </FlowSheet.Pane>

      <FlowSheet.Pane name="booking">
      {/* Booking / Searching for driver */}
      {showBooking && (
        <AnimatedSection visible={showBooking} delay={0}>
          <View style={{ alignItems: "center", paddingVertical: 24, paddingBottom: 32 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#F5F5F5",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: "#111111",
                }}
              />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={{
                  color: "#111111",
                  fontSize: 22,
                  fontFamily: "GeneralSans-Bold",
                  textAlign: "center",
                }}
              >
                Finding your {bookingVehicle}
              </Text>
            </View>

            <Text
              style={{
                color: "#6B7280",
                fontSize: 14,
                fontFamily: "GeneralSans-Regular",
                textAlign: "center",
                marginTop: 8,
                marginBottom: 16,
              }}
            >
              Searching nearby drivers...
            </Text>

            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 20,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: "#111111",
                  fontSize: 15,
                  fontFamily: "GeneralSans-Bold",
                }}
              >
                Rs {bookingFare}
              </Text>
            </View>

            {rideError && (
              <>
                <View
                  style={{
                    backgroundColor: "#FEF2F2",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                    alignSelf: "stretch",
                  }}
                >
                  <Text
                    style={{
                      color: "#DC2626",
                      fontSize: 13,
                      fontFamily: "GeneralSans-Regular",
                      textAlign: "center",
                    }}
                  >
                    {rideError}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    rideLog("FIND_RIDE_RETRY_PRESSED", { status, requesting, hasTrip: !!trip });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onRequestRide();
                  }}
                  style={{
                    backgroundColor: "#111111",
                    borderRadius: 14,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    alignSelf: "stretch",
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 15,
                      fontFamily: "GeneralSans-Bold",
                    }}
                  >
                    Try again
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable onPress={onCancelRide} style={{ paddingVertical: 8 }}>
              <Text
                style={{
                  color: "#DC2626",
                  fontSize: 14,
                  fontFamily: "GeneralSans-Bold",
                  textAlign: "center",
                }}
              >
                Cancel request
              </Text>
            </Pressable>
          </View>
        </AnimatedSection>
      )}
      </FlowSheet.Pane>
      </FlowSheet>
    </View>
  );
}
