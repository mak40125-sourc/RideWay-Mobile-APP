import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "../../context/auth-context";
import { requestRide } from "../../services/ride.service";
import { buildMapRegion } from "../../utils/map-region";
import { serializeRide } from "../../utils/ride-params";
import { RideMap } from "./ride-map";
import { rideStyles as styles } from "./ride-styles";
import { RideTopBar } from "./ride-top-bar";
import type { SelectedRide } from "./ride-types";

type Props = {
  ride: SelectedRide;
};

export function RideConfirmationScreen({ ride }: Props) {
  const { user } = useAuth();
  const [requesting, setRequesting] = useState(false);
  const region = buildMapRegion(ride.pickup, ride.dropoff);

  const handleRequestRide = async () => {
    if (!user) {
      Alert.alert("Error", "You must be signed in to request a ride");
      return;
    }

    setRequesting(true);
    try {
      await requestRide({
        riderId: user.id,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        fare: ride.fare,
        distance: ride.distance,
        duration: ride.duration,
        vehicleType: ride.option.label.toLowerCase(),
      });

      // Navigate to tracking with ride data
      router.push({
        pathname: "/tracking",
        params: serializeRide(ride),
      });
    } catch (error) {
      Alert.alert(
        "Ride Request Failed",
        error instanceof Error ? error.message : "Could not request ride. Please try again."
      );
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <RideMap pickup={ride.pickup} dropoff={ride.dropoff} region={region} routePath={ride.path} />
      <RideTopBar title="Confirm your trip" subtitle="One last look before we dispatch your ride." badge="Step 3" />

      <ScrollView
        bounces={false}
        style={styles.contentCard}
        contentContainerStyle={styles.contentCardScroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Selected ride</Text>
          <Text style={styles.sectionTitle}>{ride.option.label}</Text>
          <Text style={styles.sectionText}>{ride.option.description}</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fare estimate</Text>
            <Text style={styles.detailValue}>Rs {ride.fare}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup</Text>
            <Text style={styles.detailValue}>Current location</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Drop-off</Text>
            <Text style={styles.detailValue}>Pinned destination</Text>
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, requesting && styles.primaryButtonDisabled]}
          onPress={handleRequestRide}
          disabled={requesting}>
          {requesting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>Confirm and find driver</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} disabled={requesting}>
          <Text style={[styles.back, requesting && styles.backDisabled]}>Back to ride options</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
