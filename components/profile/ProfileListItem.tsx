import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "../flow/PressableScale";

type IconName = keyof typeof Ionicons.glyphMap;

type ProfileListItemProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
};

export const ProfileListItem = memo(function ProfileListItem({
  icon,
  title,
  subtitle,
  onPress,
}: ProfileListItemProps) {
  return (
    <PressableScale scaleTo={0.97} lift={1} onPress={onPress} style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={20} color="#6B7280" />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  wrap: {
    minHeight: 60,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  row: {
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
    fontFamily: "GeneralSans-Medium",
    color: "#111111",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    color: "#6B7280",
    marginTop: 2,
  },
});
