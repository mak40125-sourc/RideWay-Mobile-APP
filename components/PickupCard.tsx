import { Text, View } from "react-native";

import { PressableScale } from "./flow/PressableScale";

type Props = {
  label: string;
  subtitle?: string;
  icon?: string;
  onPress: () => void;
};

export function PickupCard({ label, subtitle, icon = "📍", onPress }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: "#F9FAFB",
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
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: "#111111",
            fontSize: 15,
            fontFamily: "GeneralSans-Bold",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={{
            color: "#6B7280",
            fontSize: 12,
            fontFamily: "GeneralSans-Regular",
            marginTop: 1,
          }}
        >
          {subtitle ?? "Tap to change"}
        </Text>
      </View>
      <Text style={{ color: "#9CA3AF", fontSize: 12 }}>Edit</Text>
    </PressableScale>
  );
}
