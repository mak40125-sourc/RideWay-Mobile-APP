import { View } from "react-native";
import type { BottomSheetHandleProps } from "@gorhom/bottom-sheet";

export function BottomSheetHandle(_props: BottomSheetHandleProps) {
  return (
    <View
      style={{
        alignSelf: "center",
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#D1D5DB",
        marginTop: 8,
        marginBottom: 4,
      }}
    />
  );
}
