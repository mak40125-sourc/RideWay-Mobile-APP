import { ActivityIndicator, Text, View } from "react-native";

import { rideStyles as styles } from "./ride-styles";

type Props = {
  title: string;
  description: string;
  loading?: boolean;
};

export function RideStateScreen({ title, description, loading = false }: Props) {
  return (
    <View style={styles.stateScreen}>
      {loading ? <ActivityIndicator size="large" color="#0d141c" /> : null}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{description}</Text>
    </View>
  );
}
