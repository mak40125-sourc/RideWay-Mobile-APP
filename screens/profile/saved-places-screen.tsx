import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { SubScreen } from "../../components/profile/SubScreen";
import { PressableScale } from "../../components/flow/PressableScale";
import { searchDestinations } from "../../services/places";
import { getSavedPlaces, setSavedPlaces, type SavedPlace } from "../../services/local-store";
import type { SearchResult } from "../../components/home/types";

function resultLabel(item: SearchResult, fallback: string): string {
  const subtitle = [item.properties?.city || item.properties?.state, item.properties?.country]
    .filter(Boolean)
    .join(", ");
  return subtitle || fallback;
}

function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function SavedPlacesScreen() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSavedPlaces().then((stored) => {
      if (mounted) {
        setPlaces(stored);
        setLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }

    let mounted = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchDestinations(trimmed)
        .then((data) => {
          if (mounted) setResults(data);
        })
        .catch(() => {
          if (mounted) setResults([]);
        })
        .finally(() => {
          if (mounted) setSearching(false);
        });
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleAdd = (item: SearchResult) => {
    const name = item.properties?.name || query.trim() || "Saved place";
    const address = resultLabel(item, name);
    const next = [...places, { id: makeId(), name, address }];
    setPlaces(next);
    void setSavedPlaces(next);
    setQuery("");
    setResults([]);
  };

  const handleDelete = (id: string) => {
    const next = places.filter((place) => place.id !== id);
    setPlaces(next);
    void setSavedPlaces(next);
  };

  return (
    <SubScreen title="Saved Places">
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#6B7280" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a place to save"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCapitalize="words"
        />
        {searching ? <ActivityIndicator size="small" color="#111111" /> : null}
      </View>

      {query.trim().length >= 3 ? (
        results.map((item, index) => (
          <PressableScale
            key={`${index}-${item.properties?.name ?? index}`}
            scaleTo={0.97}
            lift={1}
            onPress={() => handleAdd(item)}
            style={styles.resultWrap}
          >
            <View style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name="location-outline" size={20} color="#6B7280" />
              </View>
              <View style={styles.texts}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.properties?.name || "Selected place"}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {resultLabel(item, "Add to saved places")}
                </Text>
              </View>
              <Ionicons name="add" size={20} color="#111111" />
            </View>
          </PressableScale>
        ))
      ) : loaded && places.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No saved places</Text>
          <Text style={styles.emptySubtitle}>
            Search for a place above and tap a result to save it here.
          </Text>
        </View>
      ) : (
        places.map((place) => (
          <View key={place.id} style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="star-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.texts}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {place.address}
              </Text>
            </View>
            <PressableScale
              scaleTo={0.9}
              onPress={() => handleDelete(place.id)}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={18} color="#6B7280" />
            </PressableScale>
          </View>
        ))
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: "#111111",
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    padding: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
  },
  resultWrap: {
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
  rowTitle: {
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
    color: "#111111",
  },
  rowSubtitle: {
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    color: "#6B7280",
    marginTop: 2,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#111111",
    fontSize: 18,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
