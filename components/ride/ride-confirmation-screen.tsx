import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "../../context/auth-context";
import { useRideStore } from "../../context/ride-store";
import { buildMapRegion } from "../../utils/map-region";
import { RideMap } from "./ride-map";
import { rideStyles as styles } from "./ride-styles";
import { RideTopBar } from "./ride-top-bar";

export function RideConfirmationScreen() {
  const { user } = useAuth();
  const trip = useRideStore((s) => s.trip);
  const requesting = useRideStore((s) => s.requesting);
  const requestRideAction = useRideStore((s) => s.requestRideAction);

  if (!trip) return null;

  const region = buildMapRegion(trip.pickup, trip.dropoff);

  const handleConfirm = () => {
    if (!user) {
      Alert.alert("Error", "You must be signed in to request a ride");
      return;
    }

    requestRideAction(user.id);
  };

  return (
    <View style={styles.screen}>
      <RideMap pickup={trip.pickup} dropoff={trip.dropoff} region={region} routePath={trip.path} />
      <RideTopBar title="Confirm your trip" subtitle="Review your ride details before we find a driver." />

      <ScrollView
        bounces={false}
        style={styles.contentCard}
        contentContainerStyle={styles.contentCardScroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Selected ride</Text>
          <Text style={styles.sectionTitle}>{trip.option.label}</Text>
          <Text style={styles.sectionText}>{trip.option.description}</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fare estimate</Text>
            <Text style={styles.detailValue}>Rs {trip.fare}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup</Text>
            <Text style={styles.detailValue}>{trip.pickup.latitude.toFixed(4)}, {trip.pickup.longitude.toFixed(4)}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Drop-off</Text>
            <Text style={styles.detailValue}>{trip.dropoff.latitude.toFixed(4)}, {trip.dropoff.longitude.toFixed(4)}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, requesting && styles.primaryButtonDisabled]}
          onPress={handleConfirm}
          disabled={requesting}>
          {requesting ? (
            <Text style={styles.primaryButtonText}>Requesting...</Text>
          ) : (
            <Text style={styles.primaryButtonText}>Confirm and find driver</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
