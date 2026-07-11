import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { RideOption } from "../home/types";
import { calculateRideFare } from "./ride-helpers";
import { rideStyles as styles } from "./ride-styles";

type Props = {
  distance: number | null;
  duration: number | null;
  options: RideOption[];
  selectedOptionLabel?: string | null;
  onBack?: () => void;
  onSelectOption?: (option: RideOption, fare: number) => void;
  onContinue?: () => void;
};

export function RideOptionsSheet({
  distance,
  duration,
  options,
  selectedOptionLabel,
  onBack,
  onSelectOption,
  onContinue,
}: Props) {
  const tripMinutes = Math.max(1, Math.round(duration ?? 0));
  const dropTime = new Date(Date.now() + tripMinutes * 60 * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const getOptionIcon = (label: string) => {
    return label.slice(0, 2).toUpperCase();
  };

  return (
    <View style={styles.card}>
      <View style={styles.handle} />
      <Text style={styles.title}>Choose your ride</Text>
      <Text style={styles.subtitle}>
        {distance?.toFixed(1) ?? "--"} km &middot; {tripMinutes} min
      </Text>

      <View style={styles.optionsScrollArea}>
        <ScrollView
          bounces={false}
          style={styles.optionsScroll}
          contentContainerStyle={styles.cardScrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.optionsList}>
            {options.map((option) => {
              const fare = distance !== null && duration !== null ? calculateRideFare(option, distance, duration) : 0;
              const isSelected = selectedOptionLabel === option.label;

              return (
                <Pressable
                  key={option.label}
                  style={({ pressed }) => [
                    styles.optionCard,
                    isSelected ? styles.optionCardSelected : null,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onSelectOption?.(option, fare);
                  }}>
                  <View style={styles.optionLeft}>
                    <View style={styles.optionIconWrap}>
                      <Text style={styles.optionIcon}>{getOptionIcon(option.label)}</Text>
                    </View>
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>{option.label}</Text>
                      <Text numberOfLines={1} style={styles.optionDescription}>
                        {option.description} &middot; Drop by {dropTime}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.optionFare}>Rs {fare}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.sheetFooter}>
          {onContinue ? (
            <Pressable style={styles.primaryButton} onPress={onContinue}>
              <Text style={styles.primaryButtonText}>Confirm ride</Text>
            </Pressable>
          ) : null}

          {onBack ? (
            <Pressable onPress={onBack}>
              <Text style={styles.back}>Back</Text>
            </Pressable>
          ) : null}
      </View>
    </View>
  );
}
