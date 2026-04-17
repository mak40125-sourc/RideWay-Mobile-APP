import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { homeStyles as styles } from "./home-styles";

export function HomeHeader() {
  return (
    <View style={styles.topBar}>
      <View>
        <Text style={styles.brand}>RideWay</Text>
        <Text style={styles.brandSubtext}>Pickup, match, ride, arrive</Text>
      </View>
      <Pressable style={styles.liveBadge} onPress={() => router.push("/profile" as any)}>
        <Text style={styles.liveBadgeText}>Profile</Text>
      </Pressable>
    </View>
  );
}
