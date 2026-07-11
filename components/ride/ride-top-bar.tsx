import { Text, View } from "react-native";

import { rideStyles as styles } from "./ride-styles";

type Props = {
  title: string;
  subtitle: string;
};

export function RideTopBar({ title, subtitle }: Props) {
  return (
    <View style={styles.topBar}>
      <View>
        <Text style={styles.topBarTitle}>{title}</Text>
        <Text style={styles.topBarSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}
