import { Pressable, ScrollView, Text, View } from "react-native";

import { useRideStore } from "../../context/ride-store";
import { RideMap } from "./ride-map";
import { rideStyles as styles } from "./ride-styles";
import { RideTopBar } from "./ride-top-bar";

type Props = {
  onReturnHome: () => void;
};

export function RideCompleteScreen({ onReturnHome }: Props) {
  const trip = useRideStore((s) => s.trip);

  if (!trip) return null;

  const region = {
    latitude: (trip.pickup.latitude + trip.dropoff.latitude) / 2,
    longitude: (trip.pickup.longitude + trip.dropoff.longitude) / 2,
    latitudeDelta: Math.abs(trip.pickup.latitude - trip.dropoff.latitude) + 0.08,
    longitudeDelta: Math.abs(trip.pickup.longitude - trip.dropoff.longitude) + 0.08,
  };

  return (
    <View style={styles.screen}>
      <RideMap pickup={trip.pickup} dropoff={trip.dropoff} region={region} routePath={trip.path} />
      <RideTopBar title="Trip complete" subtitle="Your ride has ended. Review the details below." />

      <ScrollView
        bounces={false}
        style={styles.contentCard}
        contentContainerStyle={styles.contentCardScroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Trip summary</Text>
          <Text style={styles.sectionTitle}>{trip.option.label}</Text>
          <Text style={styles.sectionText}>
            {trip.distance} km &middot; {trip.duration} min
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.sectionLabel}>Total fare</Text>
          <Text style={styles.statValue}>Rs {trip.fare}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.sectionLabel}>Distance</Text>
            <Text style={styles.statValue}>{trip.distance} km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.sectionLabel}>Duration</Text>
            <Text style={styles.statValue}>{trip.duration} min</Text>
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={onReturnHome}>
          <Text style={styles.primaryButtonText}>Back to home</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
