import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Switch, Text, View } from "react-native";

type IconName = keyof typeof Ionicons.glyphMap;

type SettingRowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SettingRow({ icon, title, subtitle, value, onValueChange }: SettingRowProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={20} color="#6B7280" />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#E5E7EB", true: "#111111" }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E5E7EB"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  texts: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
    color: "#111111",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    color: "#6B7280",
    marginTop: 2,
  },
});
