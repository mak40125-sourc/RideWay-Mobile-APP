import * as Haptics from "expo-haptics";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { calculateRideFare } from "../ride/ride-helpers";
import { homeStyles as styles } from "./home-styles";
import type { RideEstimate, RideOption, SearchResult } from "./types";

type Props = {
  query: string;
  setQuery: (value: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  selectedDestination: SearchResult | null;
  destinationLabel: string;
  loadingEstimate: boolean;
  estimate: RideEstimate | null;
  locationLabel: string;
  isRefreshingLocation: boolean;
  onRefreshLocation: () => void;
  rideOptions?: RideOption[];
  selectedOptionLabel?: string | null;
  onSelectOption?: (option: RideOption, fare: number) => void;
  currentFare?: number;
  onSelectDestination: (item: SearchResult, title: string) => void;
  onResetDestination: () => void;
  onContinue: () => void;
};

export function HomeSearchSheet({
  query,
  setQuery,
  results,
  isSearching,
  selectedDestination,
  destinationLabel,
  loadingEstimate,
  estimate,
  locationLabel,
  isRefreshingLocation,
  onRefreshLocation,
  rideOptions,
  selectedOptionLabel,
  onSelectOption,
  currentFare,
  onSelectDestination,
  onResetDestination,
  onContinue,
}: Props) {
  const tripMinutes = estimate ? Math.max(1, Math.round(estimate.duration)) : 0;
  const dropTime = new Date(Date.now() + tripMinutes * 60 * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const getOptionMeta = (label: string) => {
    const normalized = label.toLowerCase();

    if (normalized.includes("bike") || normalized.includes("dash")) {
      return { icon: "BK", eta: "2 min away" };
    }

    if (normalized.includes("auto")) {
      return { icon: "AU", eta: "3 min away" };
    }

    if (normalized.includes("premium") || normalized.includes("comfort")) {
      return { icon: "PR", eta: "5 min away" };
    }

    if (normalized.includes("mega") || normalized.includes("xl")) {
      return { icon: "XL", eta: "6 min away" };
    }

    return { icon: "CB", eta: "4 min away" };
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.eyebrow}>START YOUR TRIP</Text>
      <Text style={styles.title}>Where to?</Text>

      <View style={styles.searchShell}>
        <TextInput
          placeholder="Search destination"
          placeholderTextColor="#6b7280"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {!selectedDestination ? (
        <>
          <Pressable style={({ pressed }) => [styles.locationPicker, pressed && { opacity: 0.7 }]} onPress={onRefreshLocation}>
            <Text style={styles.statusLabel}>
              Pickup: <Text style={styles.statusValue}>{locationLabel}</Text>
            </Text>
            <Text style={styles.secondaryButtonText}>{isRefreshingLocation ? "Locating..." : "Tap to refresh"}</Text>
          </Pressable>

          {isSearching ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#111111" />
              <Text style={styles.loadingText}>Searching places near you</Text>
            </View>
          ) : null}

          <FlatList
            data={results}
            keyExtractor={(_, index) => `result-${index}`}
            keyboardShouldPersistTaps="handled"
            style={styles.resultsWrapper}
            contentContainerStyle={styles.resultsList}
            ListEmptyComponent={
              query.trim().length >= 3 ? (
                <Text style={styles.emptyText}>No matching destinations yet. Try a nearby landmark or area.</Text>
              ) : null
            }
            renderItem={({ item }) => {
              const title = item.properties?.name || "Selected destination";
              const subtitle = [item.properties?.city || item.properties?.state, item.properties?.country].filter(Boolean).join(", ");

              return (
                <Pressable style={styles.resultCard} onPress={() => onSelectDestination(item, title)}>
                  <Text style={styles.resultTitle}>{title}</Text>
                  <Text style={styles.resultSubtitle}>{subtitle || "Tap to continue the rider flow"}</Text>
                </Pressable>
              );
            }}
          />
        </>
      ) : (
        <>
          <View style={styles.destinationCard}>
            <Text style={styles.destinationLabel}>Destination</Text>
            <Text style={styles.destinationTitle}>{destinationLabel}</Text>
            <Pressable onPress={onResetDestination}>
              <Text style={styles.changeLink}>Change destination</Text>
            </Pressable>
          </View>

          {loadingEstimate ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color="#111111" />
              <Text style={styles.loadingText}>Calculating route and travel time</Text>
            </View>
          ) : null}

          {estimate ? (
            <View style={styles.optionsContainer}>
              <View style={styles.optionsHeader}>
                <Text style={styles.optionsTitle}>Choose a ride</Text>
                <Text style={styles.optionsSubtitle}>
                  {estimate.distance.toFixed(1)} km - {tripMinutes} mins
                </Text>
              </View>

              <View style={styles.optionsScrollArea}>
                <ScrollView
                  style={styles.optionsList}
                  contentContainerStyle={styles.optionsListContent}
                  showsVerticalScrollIndicator={false}>
                  {rideOptions?.map((option) => {
                    const isSelected = selectedOptionLabel === option.label;
                    const fare = calculateRideFare(option, estimate.distance, estimate.duration);
                    const meta = getOptionMeta(option.label);

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
                            <Text style={styles.optionIcon}>{meta.icon}</Text>
                          </View>
                          <View style={styles.optionInfo}>
                            <Text style={styles.optionTitle}>{option.label}</Text>
                            <Text style={styles.optionDescription} numberOfLines={1}>
                              {meta.eta} - Drop {dropTime}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.optionPrice}>Rs {fare}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Personal - Cash</Text>
                <Text style={styles.promoLink}>Add Promo</Text>
              </View>

              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onContinue();
                }}>
                <Text style={styles.primaryButtonText}>
                  Find Ride {selectedOptionLabel ? `- ${selectedOptionLabel}` : ""}{" "}
                  {currentFare ? `Rs ${currentFare}` : ""}
                </Text>
              </Pressable>
            </View>
          ) : !loadingEstimate ? (
            <Text style={styles.emptyText}>We couldn&apos;t calculate this route yet. Try choosing a different stop.</Text>
          ) : null}
        </>
      )}
    </View>
  );
}
