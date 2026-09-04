import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";

import { useHomeStore, type Passenger, type PassengerMode } from "../../store/homeStore";
import { useRideStore } from "../../context/ride-store";
import { PickupCard } from "../PickupCard";
import { AnimatedSection } from "./AnimatedSection";
import { PressableScale } from "../flow/PressableScale";
import { calculateRideFare } from "../ride/ride-helpers";
import { RIDE_ICON_ASSETS, rideOptions } from "../ride/ride-config";
import { rideLog } from "../../utils/ride-request-diagnostics";

type Props = {
  onOpenLocationSelect: (mode: "pickup" | "destination") => void;
  onRequestRide: () => void;
  onCancelRide: () => void;
};

export function BottomSheetContent({ onOpenLocationSelect, onRequestRide, onCancelRide }: Props) {
  const pickup = useHomeStore((s) => s.pickup);
  const destination = useHomeStore((s) => s.destination);
  const estimate = useHomeStore((s) => s.estimate);
  const loadingEstimate = useHomeStore((s) => s.loadingEstimate);
  const selectedOption = useHomeStore((s) => s.selectedOption);
  const setSelectedOption = useHomeStore((s) => s.setSelectedOption);
  const passengerMode = useHomeStore((s) => s.passengerMode);
  const setPassengerMode = useHomeStore((s) => s.setPassengerMode);
  const passenger = useHomeStore((s) => s.passenger);
  const setPassenger = useHomeStore((s) => s.setPassenger);

  const status = useRideStore((s) => s.status);
  const requesting = useRideStore((s) => s.requesting);
  const trip = useRideStore((s) => s.trip);
  const rideError = useRideStore((s) => s.error);

  const bothSet = !!pickup && !!destination;
  const showBooking = status === "SEARCHING_DRIVER" || status === "REQUESTING" || requesting;
  // Ride options + passenger are revealed only once the route is ready — this is
  // what makes the flow feel progressive rather than a static form.
  const showOptions = bothSet && !!estimate && !showBooking;
  const showSearchPrompt = bothSet && !estimate && loadingEstimate;

  const passengerValid =
    passengerMode === "self" || (!!passenger?.name.trim() && !!passenger?.phone.trim());

  const pickupLabel = pickup?.address ?? "Current location";
  const destinationLabel = destination?.address ?? "Where are you going?";

  const tripMinutes = estimate ? Math.max(1, Math.round(estimate.duration)) : 0;
  const dropTime = new Date(Date.now() + tripMinutes * 60 * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const getOptionMeta = (label: string) => {
    const n = label.toLowerCase();
    if (n.includes("bike") || n.includes("dash")) return { icon: "BK", eta: "2 min away" };
    if (n.includes("auto")) return { icon: "AU", eta: "3 min away" };
    if (n.includes("premium") || n.includes("comfort")) return { icon: "PR", eta: "5 min away" };
    if (n.includes("mega") || n.includes("xl")) return { icon: "XL", eta: "6 min away" };
    return { icon: "CB", eta: "4 min away" };
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
      <Text style={title}>Where to?</Text>

      {/* Pickup — opens the pickup selection mode (map + center marker). */}
      <PickupCard
        label={pickupLabel}
        subtitle={pickup ? (pickup.address ? "Tap to change" : "Using GPS — tap to adjust") : "Current location"}
        onPress={() => onOpenLocationSelect("pickup")}
      />

      <View style={{ height: 12 }} />

      {/* Destination — opens the destination selection mode. */}
      <PickupCard
        label={destinationLabel}
        subtitle={destination ? (destination.address ? "Tap to change" : "Tap to adjust") : "Where are you going?"}
        icon="🏁"
        onPress={() => onOpenLocationSelect("destination")}
      />

      {!bothSet && (
        <Text style={hint}>
          {pickup ? "Choose your destination to see available rides." : "Confirm your pickup to continue."}
        </Text>
      )}

      {showSearchPrompt && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 }}>
          <ActivityIndicator size="small" color="#111111" />
          <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular" }}>
            Calculating route and travel time…
          </Text>
        </View>
      )}

      {/* Ride selection + passenger + request — revealed as the result of the
          user's action (both endpoints chosen → route computed). */}
      <AnimatedSection visible={showOptions} delay={showOptions ? 60 : 0}>
        {showOptions && estimate && (
          <View style={{ marginTop: 20 }}>
            <Text style={sectionTitle}>Choose a ride</Text>
            <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular", marginTop: 2 }}>
              {estimate.distance.toFixed(1)} km - {tripMinutes} mins
            </Text>

            <View style={{ marginTop: 12, gap: 8 }}>
              {rideOptions.map((option) => {
                const isSelected = selectedOption.label === option.label;
                const fare = calculateRideFare(option, estimate.distance, estimate.duration);
                const meta = getOptionMeta(option.label);
                const iconSource = RIDE_ICON_ASSETS[option.vehicleType];
                return (
                  <PressableScale
                    key={option.label}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedOption(option);
                    }}
                    style={[
                      optionRow,
                      { borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? "#111111" : "#E5E7EB" },
                    ]}
                  >
                    <View style={optionIcon}>
                      {iconSource ? (
                        <Text style={{ fontSize: 22 }}>{meta.icon}</Text>
                      ) : (
                        <Text style={{ color: "#111111", fontSize: 12, fontFamily: "GeneralSans-Bold" }}>{meta.icon}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#111111", fontSize: 16, fontFamily: "GeneralSans-Bold" }}>{option.label}</Text>
                      <Text style={{ color: "#6B7280", fontSize: 13, fontFamily: "GeneralSans-Regular", marginTop: 2 }}>
                        {meta.eta} - Drop {dropTime}
                      </Text>
                    </View>
                    <Text style={{ color: "#111111", fontSize: 18, fontFamily: "GeneralSans-Bold", marginLeft: 12 }}>
                      Rs {fare}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            {/* Who is riding — compact, cohesive selection control. */}
            <View style={{ marginTop: 20 }}>
              <Text style={caption}>Who is riding?</Text>
              <View style={{ marginTop: 10 }}>
                <PassengerSelector mode={passengerMode} onSelect={setPassengerMode} />
              </View>

              <AnimatedSection visible={passengerMode === "other"} delay={passengerMode === "other" ? 40 : 0}>
                {passengerMode === "other" && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <TextInput
                      style={input}
                      placeholder="Passenger name"
                      placeholderTextColor="#9CA3AF"
                      value={passenger?.name ?? ""}
                      onChangeText={(t) => setPassenger({ name: t, phone: passenger?.phone ?? "" } as Passenger)}
                    />
                    <TextInput
                      style={input}
                      placeholder="Passenger phone"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={passenger?.phone ?? ""}
                      onChangeText={(t) => setPassenger({ name: passenger?.name ?? "", phone: t } as Passenger)}
                    />
                    {!passengerValid && (
                      <Text style={{ color: "#DC2626", fontSize: 12, fontFamily: "GeneralSans-Regular" }}>
                        Enter the passenger’s name and phone to continue.
                      </Text>
                    )}
                  </View>
                )}
              </AnimatedSection>
            </View>

            <PressableScale
              disabled={requesting || !passengerValid}
              onPress={() => {
                rideLog("FIND_RIDE_PRESSED", { status, requesting, hasTrip: !!trip, passengerMode, passengerValid });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onRequestRide();
              }}
              style={[confirmButton, { backgroundColor: requesting || !passengerValid ? "#9CA3AF" : "#111111" }]}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontFamily: "GeneralSans-Bold" }}>
                Find Ride - {selectedOption.label} Rs {calculateRideFare(selectedOption, estimate.distance, estimate.duration)}
              </Text>
            </PressableScale>

            {rideError && (
              <Text style={{ color: "#DC2626", fontSize: 13, fontFamily: "GeneralSans-Regular", textAlign: "center", marginTop: 8 }}>
                {rideError}
              </Text>
            )}
          </View>
        )}
      </AnimatedSection>

      {/* Searching state replaces the request CTA once the ride is submitted. */}
      <AnimatedSection visible={showBooking} delay={showBooking ? 40 : 0}>
        {showBooking && (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
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
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#111111" }} />
            </View>
            <Text style={{ color: "#111111", fontSize: 22, fontFamily: "GeneralSans-Bold", textAlign: "center" }}>
              Finding your {trip?.option?.label || selectedOption.label}
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 14, fontFamily: "GeneralSans-Regular", textAlign: "center", marginTop: 8, marginBottom: 16 }}>
              Searching nearby drivers…
            </Text>
            {rideError && (
              <View style={{ backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, marginBottom: 12, alignSelf: "stretch" }}>
                <Text style={{ color: "#DC2626", fontSize: 13, fontFamily: "GeneralSans-Regular", textAlign: "center" }}>{rideError}</Text>
              </View>
            )}
            {rideError && (
              <PressableScale
                scaleTo={0.97}
                onPress={onRequestRide}
                style={[confirmButton, { backgroundColor: "#111111", marginBottom: 12 }]}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontFamily: "GeneralSans-Bold" }}>Try again</Text>
              </PressableScale>
            )}
            <Pressable onPress={onCancelRide} style={{ paddingVertical: 8 }}>
              <Text style={{ color: "#DC2626", fontSize: 14, fontFamily: "GeneralSans-Bold" }}>Cancel request</Text>
            </Pressable>
          </View>
        )}
      </AnimatedSection>
    </View>
  );
}

function PassengerSelector({ mode, onSelect }: { mode: PassengerMode; onSelect: (m: PassengerMode) => void }) {
  return (
    <View style={selectorContainer}>
      <PassengerOption label="Me" selected={mode === "self"} onPress={() => onSelect("self")} />
      <PassengerOption label="Someone else" selected={mode === "other"} onPress={() => onSelect("other")} />
    </View>
  );
}

function PassengerOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[
        selectorOption,
        selected && selectedOptionShadow,
        { backgroundColor: selected ? "#FFFFFF" : "transparent" },
      ]}
    >
      <View style={[radio, { borderColor: selected ? "#111111" : "#9CA3AF" }]}>
        {selected && <View style={radioInner} />}
      </View>
      <Text
        style={[
          selectorLabel,
          { color: selected ? "#111111" : "#6B7280", fontFamily: selected ? "GeneralSans-Bold" : "GeneralSans-Regular" },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const title: any = {
  color: "#111111",
  fontSize: 28,
  lineHeight: 32,
  fontFamily: "GeneralSans-Bold",
  marginBottom: 16,
};

const hint: any = {
  color: "#6B7280",
  fontSize: 13,
  fontFamily: "GeneralSans-Regular",
  marginTop: 16,
};

const sectionTitle: any = {
  color: "#111111",
  fontSize: 18,
  fontFamily: "GeneralSans-Bold",
};

const caption: any = {
  color: "#6B7280",
  fontSize: 11,
  fontFamily: "GeneralSans-Bold",
  letterSpacing: 1.2,
  textTransform: "uppercase",
};

const selectorContainer: any = {
  flexDirection: "row",
  alignItems: "stretch",
  backgroundColor: "#F9FAFB",
  borderRadius: 16,
  padding: 6,
  gap: 6,
};

const selectorOption: any = {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  minHeight: 48,
  borderRadius: 12,
};

const selectedOptionShadow: any = {
  shadowColor: "#000000",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

const radio: any = {
  width: 20,
  height: 20,
  borderRadius: 10,
  borderWidth: 2,
  alignItems: "center",
  justifyContent: "center",
};

const radioInner: any = {
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: "#111111",
};

const selectorLabel: any = {
  fontSize: 15,
  fontFamily: "GeneralSans-Regular",
};

const optionRow: any = {
  backgroundColor: "#FFFFFF",
  borderRadius: 14,
  paddingHorizontal: 12,
  paddingVertical: 12,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
};

const optionIcon: any = {
  width: 48,
  height: 48,
  borderRadius: 12,
  backgroundColor: "#F5F5F5",
  alignItems: "center",
  justifyContent: "center",
};

const input: any = {
  backgroundColor: "#FFFFFF",
  borderRadius: 14,
  paddingHorizontal: 16,
  height: 52,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  color: "#111111",
  fontSize: 15,
  fontFamily: "GeneralSans-Regular",
};

const confirmButton: any = {
  borderRadius: 18,
  height: 56,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 16,
  marginBottom: 8,
};
