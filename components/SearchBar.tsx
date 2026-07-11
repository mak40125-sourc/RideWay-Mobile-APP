import { TextInput, View } from "react-native";
import { useHomeStore } from "../store/homeStore";

export function SearchBar() {
  const query = useHomeStore((s) => s.query);
  const setQuery = useHomeStore((s) => s.setQuery);

  return (
    <View
      style={{
        height: 52,
        borderRadius: 14,
        paddingHorizontal: 16,
        backgroundColor: "#F5F5F5",
        justifyContent: "center",
      }}
    >
      <TextInput
        placeholder="Search destination"
        placeholderTextColor="#6B7280"
        value={query}
        onChangeText={setQuery}
        style={{
          fontSize: 16,
          color: "#111111",
          fontFamily: "NeueMontreal-Regular",
          padding: 0,
        }}
      />
    </View>
  );
}
