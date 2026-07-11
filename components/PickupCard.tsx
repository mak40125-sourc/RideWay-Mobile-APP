import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useHomeStore } from "../store/homeStore";

type Props = {
  onRefreshLocation: () => void;
};

export function PickupCard({ onRefreshLocation }: Props) {
  const location = useHomeStore((s) => s.location);
  const permissionDenied = useHomeStore((s) => s.permissionDenied);
  const isRefreshingLocation = useHomeStore((s) => s.isRefreshingLocation);

  const locationLabel = location
    ? `Lat ${location.latitude.toFixed(4)}, Lng ${location.longitude.toFixed(4)}`
    : permissionDenied
      ? "Location permission required"
      : "Current location unavailable";

  return (
    <Pressable
      onPress={onRefreshLocation}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
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
          Pickup
        </Text>
        <Text
          style={{
            color: "#111111",
            fontSize: 14,
            fontFamily: "NeueMontreal-Regular",
          }}
          numberOfLines={1}
        >
          {locationLabel}
        </Text>
      </View>
      {isRefreshingLocation ? (
        <ActivityIndicator size="small" color="#111111" />
      ) : (
        <Text
          style={{
            color: "#6B7280",
            fontSize: 13,
            fontFamily: "NeueMontreal-Bold",
            marginLeft: 8,
          }}
        >
          Refresh
        </Text>
      )}
    </Pressable>
  );
}
