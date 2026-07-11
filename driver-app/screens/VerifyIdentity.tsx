import { useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { DocumentCard } from "../components/DocumentCard";
import { VerificationInfo } from "../components/VerificationInfo";

export interface DocumentItem {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface VerifyIdentityProps {
  documents: DocumentItem[];
  uploaded: Record<string, boolean>;
  allUploaded: boolean;
  onUpload: (key: string) => void;
  onContinue: () => void;
  onSettings?: () => void;
}

export function VerifyIdentity({
  documents,
  uploaded,
  allUploaded,
  onUpload,
  onContinue,
  onSettings,
}: VerifyIdentityProps) {
  const renderCard = useCallback(
    (doc: DocumentItem, index: number) => (
      <Animated.View key={doc.key} entering={FadeIn.delay(index * 100).duration(400)}>
        <DocumentCard
          title={doc.label}
          subtitle={doc.description}
          uploaded={uploaded[doc.key] ?? false}
          icon={doc.icon}
          onPress={() => onUpload(doc.key)}
        />
      </Animated.View>
    ),
    [uploaded, onUpload]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Verify Identity</Text>
            <Text style={styles.subtitle}>Upload your documents to get verified</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={onSettings}>
            <Ionicons name="person-outline" size={22} color="#111111" />
          </TouchableOpacity>
        </View>

        {documents.map((doc, index) => renderCard(doc, index))}

        <VerificationInfo />

        <Animated.View entering={FadeIn.duration(500)}>
          <TouchableOpacity
            style={[styles.continueBtn, !allUploaded && styles.continueBtnDisabled]}
            onPress={onContinue}
            disabled={!allUploaded}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  headerText: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 28,
    color: "#111111",
    fontFamily: "NeueMontreal-Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: "#7A7A7A",
    fontFamily: "NeueMontreal-Regular",
    lineHeight: 22,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FAFAFA",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  continueBtn: {
    height: 56,
    backgroundColor: "#111111",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueBtnText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "NeueMontreal-Bold",
  },
});
