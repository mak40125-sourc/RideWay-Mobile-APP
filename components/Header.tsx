import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function Header() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 20,
        right: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10,
      }}
    >
      <View>
        <Text
          style={{
            color: "#111111",
            fontSize: 30,
            fontFamily: "NeueMontreal-Bold",
          }}
        >
          RideWay
        </Text>
        <Text
          style={{
            color: "#6B7280",
            fontSize: 14,
            marginTop: 2,
            fontFamily: "NeueMontreal-Regular",
          }}
        >
          Pickup, match, ride
        </Text>
      </View>
    </View>
  );
}
