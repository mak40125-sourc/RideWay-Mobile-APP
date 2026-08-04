import { StyleSheet, Text, View } from "react-native";

import { SubScreen } from "../../components/profile/SubScreen";

const PARAGRAPHS = [
  "Velos is designed to get you where you need to go. This page explains, in simple terms, the data we collect and how we use it.",
  "Account information such as your name and phone number is used to manage your rides, contact you about a trip, and secure your account.",
  "Trip information such as your pickup and drop-off locations, route and fare is used to provide, improve and keep safe the rides you book.",
  "We do not sell your personal information. You can update your name and phone number anytime from Personal Information in your profile.",
  "For anything not covered here, reach out to our support team through Help & Support and we will be happy to help.",
];

export function PrivacyScreen() {
  return (
    <SubScreen title="Privacy">
      {PARAGRAPHS.map((paragraph, index) => (
        <View key={index} style={styles.block}>
          <Text style={styles.body}>{paragraph}</Text>
        </View>
      ))}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 20,
  },
  body: {
    color: "#6B7280",
    fontSize: 15,
    fontFamily: "GeneralSans-Regular",
    lineHeight: 22,
  },
});
