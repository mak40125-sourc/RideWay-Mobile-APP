import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  type ReactNode,
} from "react";
import { BackHandler, ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlowScreen, FlowStagger, useFlowScreen } from "../flow/FlowScreen";
import { PressableScale } from "../flow/PressableScale";

export type SubScreenHandle = {
  goBack: () => void;
};

type SubScreenProps = {
  title: string;
  children?: ReactNode;
};

export const SubScreen = forwardRef<SubScreenHandle, SubScreenProps>(
  function SubScreen({ title, children }, ref) {
    const insets = useSafeAreaInsets();
    const { progress, opacity, settled, exit } = useFlowScreen();

    const goBack = useCallback(() => {
      exit(() => router.back());
    }, [exit]);

    useImperativeHandle(ref, () => ({ goBack }), [goBack]);

    useEffect(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [goBack]);

    return (
      <FlowScreen progress={progress} opacity={opacity} settled={settled}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.shell,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <FlowStagger fromOpacity={0.5}>
            <PressableScale scaleTo={0.96} onPress={goBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#111111" />
            </PressableScale>

            <Text style={styles.title}>{title}</Text>

            {children}
          </FlowStagger>
        </ScrollView>
      </FlowScreen>
    );
  }
);

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
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "600",
    color: "#111111",
    marginBottom: 24,
  },
});
