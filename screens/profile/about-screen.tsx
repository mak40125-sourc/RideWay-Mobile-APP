import Constants from "expo-constants";
import { StyleSheet, Text, View } from "react-native";

import { SubScreen } from "../../components/profile/SubScreen";

export function AboutScreen() {
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <SubScreen title="About Velos">
      <View style={styles.mark}>
        <Text style={styles.markInitial}>V</Text>
      </View>

      <Text style={styles.name}>Velos</Text>
      <Text style={styles.version}>Version {version}</Text>

      <Text style={styles.body}>
        Velos is a ride-hailing experience built on calm, considered motion. Every screen
        moves with intent so the interface always feels like one continuous environment.
      </Text>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  markInitial: {
    fontSize: 28,
    fontFamily: "GeneralSans-Bold",
    color: "#111111",
  },
  name: {
    fontSize: 24,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "600",
    color: "#111111",
  },
  version: {
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 24,
  },
  body: {
    color: "#6B7280",
    fontSize: 15,
    fontFamily: "GeneralSans-Regular",
    lineHeight: 22,
  },
});
