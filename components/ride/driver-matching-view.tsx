import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  vehicleLabel: string;
  fare: number;
  onCancel: () => void;
};

function AnimatedDots() {
  const opacity1 = useRef(new Animated.Value(0)).current;
  const opacity2 = useRef(new Animated.Value(0)).current;
  const opacity3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dot = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    const anim1 = dot(opacity1, 0);
    const anim2 = dot(opacity2, 200);
    const anim3 = dot(opacity3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [opacity1, opacity2, opacity3]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Animated.Text style={{ color: "#6B7280", fontSize: 24, lineHeight: 24, opacity: opacity1 }}>.</Animated.Text>
      <Animated.Text style={{ color: "#6B7280", fontSize: 24, lineHeight: 24, opacity: opacity2 }}>.</Animated.Text>
      <Animated.Text style={{ color: "#6B7280", fontSize: 24, lineHeight: 24, opacity: opacity3 }}>.</Animated.Text>
    </View>
  );
}

function PulseRing({
  size,
  delay,
  duration,
  style,
}: {
  size: number;
  delay: number;
  duration: number;
  style?: object;
}) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    anim.start();

    return () => anim.stop();
  }, [scale, opacity, delay, duration]);

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: "#111111",
          transform: [{ scale }],
          opacity,
        },
        style,
      ]}
    />
  );
}

export function DriverMatchingView({ vehicleLabel, fare, onCancel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, 24),
      }}
    >
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 16,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "#F5F5F5",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <PulseRing size={80} delay={0} duration={2000} />
          <PulseRing size={80} delay={1000} duration={2000} />
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: "#111111",
            }}
          />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Text
            style={{
              color: "#111111",
              fontSize: 22,
              fontFamily: "NeueMontreal-Bold",
              textAlign: "center",
            }}
          >
            Finding your {vehicleLabel}
          </Text>
          <AnimatedDots />
        </View>

        <Text
          style={{
            color: "#6B7280",
            fontSize: 14,
            fontFamily: "NeueMontreal-Regular",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Searching nearby drivers...
        </Text>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 20,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: "#111111",
              fontSize: 15,
              fontFamily: "NeueMontreal-Bold",
            }}
          >
            Rs {fare}
          </Text>
        </View>

        <Pressable onPress={onCancel} style={{ paddingVertical: 8 }}>
          <Text
            style={{
              color: "#DC2626",
              fontSize: 14,
              fontFamily: "NeueMontreal-Bold",
              textAlign: "center",
            }}
          >
            Cancel request
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
