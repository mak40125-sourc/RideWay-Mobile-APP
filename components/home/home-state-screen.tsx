import { ActivityIndicator, Text, View } from "react-native";

import { homeStyles as styles } from "./home-styles";

type Props = {
  title: string;
  description: string;
  loading?: boolean;
};

export function HomeStateScreen({ title, description, loading = false }: Props) {
  return (
    <View style={styles.stateScreen}>
      {loading ? <ActivityIndicator size="large" color="#0d141c" /> : null}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{description}</Text>
    </View>
  );
}
