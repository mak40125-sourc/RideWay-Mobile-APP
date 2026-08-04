import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { router, type Href } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../context/auth-context";
import { FlowStagger } from "../../components/flow/FlowScreen";
import { PressableScale } from "../../components/flow/PressableScale";
import { ProfileListItem } from "../../components/profile/ProfileListItem";

type IconName = keyof typeof Ionicons.glyphMap;

type MenuItem = {
  icon: IconName;
  title: string;
  route: Href;
};

const ACCOUNT_ITEMS: MenuItem[] = [
  { icon: "person-outline", title: "Personal Information", route: "/personal-info" },
  { icon: "time-outline", title: "Ride History", route: "/ride-history" },
  { icon: "star-outline", title: "Saved Places", route: "/saved-places" },
  { icon: "call-outline", title: "Emergency Contacts", route: "/emergency-contacts" },
  { icon: "notifications-outline", title: "Notifications", route: "/notifications" },
];

const SUPPORT_ITEMS: MenuItem[] = [
  { icon: "help-circle-outline", title: "Help & Support", route: "/help" },
  { icon: "shield-checkmark-outline", title: "Privacy", route: "/privacy" },
  { icon: "information-circle-outline", title: "About Velos", route: "/about" },
];

type ProfileSurfaceProps = {
  onClose: () => void;
};

export const ProfileSurface = memo(function ProfileSurface({
  onClose,
}: ProfileSurfaceProps) {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const initial = user?.full_name?.[0]?.toUpperCase() ?? "U";
  const phone = user?.phone ?? null;

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  const accountRows = useMemo(
    () =>
      ACCOUNT_ITEMS.map((item) => (
        <ProfileListItem
          key={item.route.toString()}
          icon={item.icon}
          title={item.title}
          onPress={() => router.push(item.route)}
        />
      )),
    []
  );

  const supportRows = useMemo(
    () =>
      SUPPORT_ITEMS.map((item) => (
        <ProfileListItem
          key={item.route.toString()}
          icon={item.icon}
          title={item.title}
          onPress={() => router.push(item.route)}
        />
      )),
    []
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.shell,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
      ]}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <FlowStagger>
        <PressableScale scaleTo={0.96} onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#111111" />
        </PressableScale>

        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {user?.full_name ?? "Rider"}
        </Text>

        {phone ? (
          <Text style={styles.phone} numberOfLines={1}>
            {phone}
          </Text>
        ) : null}

        <PressableScale scaleTo={0.97} lift={1} style={styles.editWrap}>
          <Text style={styles.editText}>Edit Profile</Text>
        </PressableScale>

        <Text style={styles.sectionLabel}>Account</Text>

        {accountRows}

        <Text style={styles.sectionLabel}>Support</Text>

        {supportRows}

        <PressableScale scaleTo={0.97} onPress={handleSignOut} style={styles.signOutWrap}>
          <View style={styles.signOut}>
            <Ionicons name="log-out-outline" size={20} color="#111111" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </View>
        </PressableScale>
      </FlowStagger>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  shell: {
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  avatarInitial: {
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
  phone: {
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    color: "#6B7280",
    marginTop: 4,
  },
  editWrap: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingVertical: 6,
    paddingRight: 4,
  },
  editText: {
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
    color: "#111111",
    textDecorationLine: "underline",
  },
  sectionLabel: {
    fontSize: 18,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "600",
    color: "#111111",
    marginTop: 40,
    marginBottom: 16,
  },
  signOutWrap: {
    marginTop: 40,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  signOutText: {
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
    color: "#111111",
  },
});
