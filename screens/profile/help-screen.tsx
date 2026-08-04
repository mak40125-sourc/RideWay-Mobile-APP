import { StyleSheet, Text, View } from "react-native";

import { SubScreen } from "../../components/profile/SubScreen";

const SECTIONS = [
  {
    title: "Booking a ride",
    body: "Search for your destination, pick a ride option and tap Find Ride. You'll see the driver matching in real time on the same screen.",
  },
  {
    title: "Changing your pickup",
    body: "Tap the pickup card at the top of the home screen to search for a different pickup point before you book.",
  },
  {
    title: "Cancelling a ride",
    body: "You can cancel anytime before your driver starts the trip. Cancelled rides appear in your ride history.",
  },
  {
    title: "Fares",
    body: "Fares are shown before you book. The final amount is confirmed at the end of the trip.",
  },
];

export function HelpSupportScreen() {
  return (
    <SubScreen title="Help & Support">
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.block}>
          <Text style={styles.heading}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 24,
  },
  heading: {
    color: "#111111",
    fontSize: 18,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "600",
    marginBottom: 8,
  },
  body: {
    color: "#6B7280",
    fontSize: 15,
    fontFamily: "GeneralSans-Regular",
    lineHeight: 22,
  },
});
