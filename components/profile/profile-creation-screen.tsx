import { router } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { profileStyles as styles } from "./profile-styles";

const roles = ["rider", "driver"] as const;

type ProfileCreationScreenProps = {
  onComplete?: () => void;
};

export function ProfileCreationScreen({ onComplete }: ProfileCreationScreenProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("rider");

  const digitsOnlyPhone = phone.replace(/\D/g, "");
  const isValid = name.trim().length >= 2 && digitsOnlyPhone.length >= 10;

  const completeProfile = () => {
    if (onComplete) {
      onComplete();
      return;
    }

    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.shell}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>First-time setup</Text>
          <Text style={styles.title}>Create your RideWay profile</Text>
          <Text style={styles.subtitle}>
            We only need a few details to get your rider profile ready for booking and future Supabase auth.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            placeholder="Enter your name"
            placeholderTextColor="#8b8f94"
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            placeholder="Enter your phone"
            placeholderTextColor="#8b8f94"
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Account type</Text>
          <Text style={styles.helperText}>Choose how you want to use RideWay for now.</Text>
          <View style={styles.roleRow}>
            {roles.map((item) => {
              const selected = item === role;

              return (
                <Pressable
                  key={item}
                  style={[styles.roleChip, selected ? styles.roleChipSelected : null]}
                  onPress={() => setRole(item)}>
                  <Text style={[styles.roleChipText, selected ? styles.roleChipTextSelected : null]}>
                    {item === "rider" ? "Rider" : "Driver"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Profile preview</Text>
            <Text style={styles.previewValue}>
              {name.trim() || "Your name"} {"\u2022"} {role === "rider" ? "Rider" : "Driver"}
            </Text>
            <Text style={styles.previewMeta}>
              {digitsOnlyPhone.length >= 4 ? `+${digitsOnlyPhone}` : "Phone number will be saved here"}
            </Text>
          </View>

          <Pressable
            style={[styles.primaryButton, !isValid ? styles.primaryButtonDisabled : null]}
            disabled={!isValid}
            onPress={completeProfile}>
            <Text style={styles.primaryButtonText}>Continue to RideWay</Text>
          </Pressable>

          <Pressable onPress={completeProfile}>
            <Text style={styles.secondaryAction}>Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
