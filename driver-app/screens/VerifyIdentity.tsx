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
}

export function VerifyIdentity({
  documents,
  uploaded,
  allUploaded,
  onUpload,
  onContinue,
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
        <Text style={styles.title}>Verify Identity</Text>
        <Text style={styles.subtitle}>Upload your documents to get verified</Text>

        <View style={styles.divider} />

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
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontFamily: "GeneralSans-Semibold",
    fontSize: 28,
    color: "#111111",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "GeneralSans-Regular",
    fontSize: 16,
    color: "#7A7A7A",
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 24,
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
    fontFamily: "GeneralSans-Semibold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
