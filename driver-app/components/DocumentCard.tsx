import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DocumentCardProps {
  title: string;
  subtitle: string;
  uploaded: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function DocumentCard({ title, subtitle, uploaded, icon, onPress }: DocumentCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={22} color="#16C784" style={styles.icon} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {uploaded ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Uploaded</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadBtn} onPress={onPress}>
          <Text style={styles.uploadBtnText}>Upload</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F1F1F1",
    padding: 16,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FAFAFA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  icon: {
    marginTop: 1,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    color: "#111111",
    fontFamily: "NeueMontreal-Bold",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: "#7A7A7A",
    fontFamily: "NeueMontreal-Regular",
  },
  badge: {
    backgroundColor: "#16C784",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontFamily: "NeueMontreal-Bold",
  },
  uploadBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#111111",
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  uploadBtnText: {
    fontSize: 13,
    color: "#111111",
    fontFamily: "NeueMontreal-Bold",
  },
});
