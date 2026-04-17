import { Pressable, ScrollView, Text, View } from "react-native";

import { RideMap } from "./ride-map";
import { rideStyles as styles } from "./ride-styles";
import { RideTopBar } from "./ride-top-bar";
import type { SelectedRide } from "./ride-types";

type Props = {
  ride: SelectedRide;
  onReturnHome: () => void;
};

export function RideCompleteScreen({ ride, onReturnHome }: Props) {
  const region = {
    latitude: (ride.pickup.latitude + ride.dropoff.latitude) / 2,
    longitude: (ride.pickup.longitude + ride.dropoff.longitude) / 2,
    latitudeDelta: Math.abs(ride.pickup.latitude - ride.dropoff.latitude) + 0.08,
    longitudeDelta: Math.abs(ride.pickup.longitude - ride.dropoff.longitude) + 0.08,
  };

  return (
    <View style={styles.screen}>
      <RideMap pickup={ride.pickup} dropoff={ride.dropoff} region={region} routePath={ride.path} />
      <RideTopBar title="Ride complete" subtitle="Fare, rating, and wallet updates now close the rider flow." badge="Step 5" />

      <ScrollView
        bounces={false}
        style={styles.contentCard}
        contentContainerStyle={styles.contentCardScroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Trip summary</Text>
          <Text style={styles.sectionTitle}>{ride.option.label} completed</Text>
          <Text style={styles.sectionText}>Your fare has been finalized and the wallet update can happen after the ride completes.</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.sectionLabel}>Final fare</Text>
          <Text style={styles.statValue}>Rs {ride.fare}</Text>
        </View>

        <View style={styles.timeline}>
          <View style={styles.timelineStep}>
            <Text style={styles.timelineTitle}>1. Fare posted</Text>
            <Text style={styles.timelineText}>The completed ride total is ready for receipts and history.</Text>
          </View>
          <View style={styles.timelineStep}>
            <Text style={styles.timelineTitle}>2. Rating placeholder</Text>
            <Text style={styles.timelineText}>This is where rider feedback and driver rating can slot in next.</Text>
          </View>
          <View style={styles.timelineStep}>
            <Text style={styles.timelineTitle}>3. Wallet update</Text>
            <Text style={styles.timelineText}>The blueprint notes wallet integration after ride completion, so this screen leaves room for it.</Text>
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={onReturnHome}>
          <Text style={styles.primaryButtonText}>Back to home</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
