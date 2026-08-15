import { Linking, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { flowTiming } from "../../constants/flow-motion";
import type { Coordinates } from "../home/types";
import type { DriverInfo, RideStatus, Trip } from "../../context/ride-store";
import { FlowSheet } from "../flow/FlowSheet";
import { PressableScale } from "../flow/PressableScale";
import { AnimatedDots, PulseRing } from "./driver-matching-view";
import { estimateDriverEtaMinutes } from "./ride-helpers";
import { rideStyles as styles } from "./ride-styles";

export const RIDE_SHEET_BASE_HEIGHT = 320;

type Props = {
  status: RideStatus;
  trip: Trip;
  driver: DriverInfo | null;
  onCancel: () => void;
  onEndRide: () => void;
  onViewSummary: () => void;
};

function sheetPhase(status: RideStatus): "searching" | "driver" | "ride" | "complete" {
  if (status === "RIDE_STARTED") return "ride";
  if (status === "RIDE_COMPLETED") return "complete";
  if (status === "DRIVER_ASSIGNED" || status === "DRIVER_ARRIVING") return "driver";
  return "searching";
}

function initialsOf(name: string): string {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "D";
}

function DriverRow({ driver, fallbackVehicle }: { driver: DriverInfo | null; fallbackVehicle: string }) {
  const name = driver?.name || "Your driver";
  const vehicleParts = [driver?.vehicleModel || driver?.vehicle, driver?.vehiclePlate].filter(Boolean);
  const vehicleLabel = vehicleParts.length ? vehicleParts.join(" · ") : fallbackVehicle;

  return (
    <View style={styles.driverRow}>
      <View style={styles.driverAvatar}>
        <Text style={styles.driverAvatarText}>{initialsOf(name)}</Text>
      </View>
      <View style={styles.driverIdentity}>
        <View style={styles.driverNameLine}>
          <Text style={styles.driverName} numberOfLines={1}>
            {name}
          </Text>
          {driver?.rating != null ? (
            <Text style={styles.driverRating}>★ {driver.rating.toFixed(1)}</Text>
          ) : null}
        </View>
        <Text style={styles.driverVehicle} numberOfLines={1}>
          {vehicleLabel}
        </Text>
      </View>
    </View>
  );
}

function ActionButtons({ phone }: { phone?: string }) {
  const handleMessage = () => {
    if (phone) Linking.openURL(`sms:${phone}`);
  };
  const handleCall = () => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={styles.actionsRow}>
      <PressableScale style={styles.actionButton} onPress={handleMessage}>
        <Ionicons name="chatbubble-outline" size={18} color="#0d141c" />
        <Text style={styles.actionText}>Message</Text>
      </PressableScale>
      <PressableScale style={styles.actionButton} onPress={handleCall}>
        <Ionicons name="call-outline" size={18} color="#0d141c" />
        <Text style={styles.actionText}>Call</Text>
      </PressableScale>
    </View>
  );
}

function EtaBlock({
  status,
  driver,
  pickup,
}: {
  status: RideStatus;
  driver: DriverInfo | null;
  pickup: Coordinates;
}) {
  if (driver?.location) {
    const minutes = estimateDriverEtaMinutes(driver.location, pickup);
    return (
      <View style={styles.etaRow}>
        <Text style={styles.etaCaption}>Arrives in</Text>
        <Text style={styles.etaValue}>{minutes} min</Text>
      </View>
    );
  }

  if (status === "DRIVER_ARRIVING") {
    return (
      <View style={styles.etaRow}>
        <Text style={styles.etaCaption}>Driver is here</Text>
        <Text style={styles.etaValue}>Now</Text>
      </View>
    );
  }

  return (
    <View style={styles.etaRow}>
      <Text style={styles.etaCaption}>Arrives in</Text>
      <Text style={styles.etaValue}>Shortly</Text>
    </View>
  );
}

function FareLine({ fare, label }: { fare: number; label: string }) {
  return (
    <View style={styles.fareRow}>
      <Text style={styles.fareAmount}>₹{fare}</Text>
      <Text style={styles.fareDivider}>·</Text>
      <Text style={styles.fareLabel}>{label}</Text>
    </View>
  );
}

function SearchingPane({ trip, onCancel }: { trip: Trip; onCancel: () => void }) {
  return (
    <View style={[styles.searchingCenter, { height: RIDE_SHEET_BASE_HEIGHT - 26, justifyContent: "center" }]}>
      <View style={styles.searchingPulseWrap}>
        <PulseRing size={80} delay={0} duration={2000} />
        <PulseRing size={80} delay={1000} duration={2000} />
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: "#111111",
          }}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={styles.searchingTitle}>Finding your {trip.option.label}</Text>
        <AnimatedDots />
      </View>
      <Text style={styles.searchingSubtitle}>Searching nearby drivers...</Text>
      <Text style={styles.searchingFare}>Rs {trip.fare}</Text>
      <PressableScale onPress={onCancel}>
        <Text style={styles.cancelRide}>Cancel request</Text>
      </PressableScale>
    </View>
  );
}

function DriverPane({
  status,
  trip,
  driver,
  onCancel,
}: {
  status: RideStatus;
  trip: Trip;
  driver: DriverInfo | null;
  onCancel: () => void;
}) {
  const copy =
    status === "DRIVER_ARRIVING"
      ? { title: "Your driver is here", subtitle: "Meet your driver at your pickup" }
      : { title: "Your driver is on the way", subtitle: "Arriving at your pickup" };

  return (
    <>
      <Text style={styles.statusTitle}>{copy.title}</Text>
      <Text style={styles.statusSubtitle}>{copy.subtitle}</Text>
      <EtaBlock status={status} driver={driver} pickup={trip.pickup} />
      <DriverRow driver={driver} fallbackVehicle={trip.option.label} />
      <ActionButtons phone={driver?.phone} />
      <FareLine fare={trip.fare} label={trip.option.label} />
      <PressableScale onPress={onCancel}>
        <Text style={styles.cancelRide}>Cancel ride</Text>
      </PressableScale>
    </>
  );
}

function RidePane({
  trip,
  driver,
  onEndRide,
}: {
  trip: Trip;
  driver: DriverInfo | null;
  onEndRide: () => void;
}) {
  return (
    <>
      <Text style={styles.statusTitle}>Ride in progress</Text>
      <Text style={styles.statusSubtitle}>Enjoy your trip</Text>
      <DriverRow driver={driver} fallbackVehicle={trip.option.label} />
      <FareLine fare={trip.fare} label={trip.option.label} />
      <PressableScale style={[styles.primaryButton, { marginTop: 14, marginBottom: 12 }]} onPress={onEndRide}>
        <Text style={styles.primaryButtonText}>End ride</Text>
      </PressableScale>
    </>
  );
}

function CompletePane({ trip, onViewSummary }: { trip: Trip; onViewSummary: () => void }) {
  return (
    <>
      <Text style={styles.statusTitle}>Ride complete</Text>
      <Text style={styles.statusSubtitle}>Thanks for riding with RideWay</Text>
      <FareLine fare={trip.fare} label={`${trip.distance} km · ${trip.duration} min`} />
      <PressableScale
        style={[styles.primaryButton, { marginTop: 14, marginBottom: 12 }]}
        onPress={onViewSummary}>
        <Text style={styles.primaryButtonText}>View trip summary</Text>
      </PressableScale>
    </>
  );
}

export function RideStatusSheet({ status, trip, driver, onCancel, onEndRide, onViewSummary }: Props) {
  const insets = useSafeAreaInsets();
  const phase = sheetPhase(status);

  return (
    <View
      style={[
        styles.statusSheet,
        { height: RIDE_SHEET_BASE_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}>
      <View style={styles.statusSheetHandle} />
      <FlowSheet state={phase} duration={flowTiming.base}>
        <FlowSheet.Pane name="searching">
          <SearchingPane trip={trip} onCancel={onCancel} />
        </FlowSheet.Pane>
        <FlowSheet.Pane name="driver">
          <DriverPane status={status} trip={trip} driver={driver} onCancel={onCancel} />
        </FlowSheet.Pane>
        <FlowSheet.Pane name="ride">
          <RidePane trip={trip} driver={driver} onEndRide={onEndRide} />
        </FlowSheet.Pane>
        <FlowSheet.Pane name="complete">
          <CompletePane trip={trip} onViewSummary={onViewSummary} />
        </FlowSheet.Pane>
      </FlowSheet>
    </View>
  );
}