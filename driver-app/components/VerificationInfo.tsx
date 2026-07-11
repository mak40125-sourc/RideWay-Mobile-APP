import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function VerificationInfo() {
  return (
    <View style={styles.card}>
      <Ionicons name="shield-checkmark-outline" size={18} color="#7A7A7A" style={styles.icon} />
      <Text style={styles.text}>
        Your documents are securely stored and only used for verification purposes.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: "#7A7A7A",
    fontFamily: "NeueMontreal-Regular",
    lineHeight: 20,
  },
});
