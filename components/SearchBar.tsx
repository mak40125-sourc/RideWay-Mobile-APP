import { TextInput, View } from "react-native";
import { useHomeStore } from "../store/homeStore";

type Props = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder }: Props) {
  const storeQuery = useHomeStore((s) => s.query);
  const setStoreQuery = useHomeStore((s) => s.setQuery);

  const activeValue = value ?? storeQuery;
  const handleChange = onChangeText ?? setStoreQuery;

  return (
    <View
      style={{
        height: 58,
        borderRadius: 18,
        paddingHorizontal: 16,
        backgroundColor: "#F5F5F5",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <View style={{ width: 20, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: "#6B7280",
          }}
        />
      </View>
      <TextInput
        placeholder={placeholder ?? "Search destination"}
        placeholderTextColor="#6B7280"
        value={activeValue}
        onChangeText={handleChange}
        style={{
          flex: 1,
          fontSize: 16,
          color: "#111111",
          fontFamily: "GeneralSans-Regular",
          padding: 0,
        }}
      />
    </View>
  );
}
