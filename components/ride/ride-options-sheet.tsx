import * as Haptics from "expo-haptics";
import { Image, ScrollView, Text, View } from "react-native";

import type { RideOption } from "../home/types";
import { calculateRideFare } from "./ride-helpers";
import { RIDE_ICON_ASSETS } from "./ride-config";
import { rideStyles as styles } from "./ride-styles";
import { PressableScale } from "../flow/PressableScale";

type Props = {
  distance: number | null;
  duration: number | null;
  options: RideOption[];
  selectedOptionLabel?: string | null;
  // Backend-authoritative fares by option label. When present they replace the
  // legacy local formula for display; the backend remains authoritative at booking.
  fares?: Record<string, number> | null;
  onBack?: () => void;
  onSelectOption?: (option: RideOption, fare: number) => void;
  onContinue?: () => void;
};

export function RideOptionsSheet({
  distance,
  duration,
  options,
  selectedOptionLabel,
  fares,
  onBack,
  onSelectOption,
  onContinue,
}: Props) {
  const tripMinutes = Math.max(1, Math.round(duration ?? 0));
  const dropTime = new Date(Date.now() + tripMinutes * 60 * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

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
              const fare =
                fares?.[option.label] ??
                (distance !== null && duration !== null ? calculateRideFare(option, distance, duration) : 0);
              const isSelected = selectedOptionLabel === option.label;
              const iconSource = RIDE_ICON_ASSETS[option.vehicleType];

              return (
                <PressableScale
                  key={option.label}
                  style={[styles.optionCard, isSelected ? styles.optionCardSelected : null]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onSelectOption?.(option, fare);
                  }}>
                  <View style={styles.optionLeft}>
                    {iconSource ? (
                      <View style={styles.optionIconWrap}>
                        <Image source={iconSource} style={styles.optionIconImage} />
                      </View>
                    ) : null}
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>{option.label}</Text>
                      <Text numberOfLines={1} style={styles.optionDescription}>
                        {option.description} &middot; Drop by {dropTime}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.optionFare}>Rs {fare}</Text>
                </PressableScale>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.sheetFooter}>
          {onContinue ? (
            <PressableScale style={styles.primaryButton} onPress={onContinue}>
              <Text style={styles.primaryButtonText}>Confirm ride</Text>
            </PressableScale>
          ) : null}

          {onBack ? (
            <PressableScale onPress={onBack}>
              <Text style={styles.back}>Back</Text>
            </PressableScale>
          ) : null}
      </View>
    </View>
  );
}
