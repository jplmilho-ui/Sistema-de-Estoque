import { View, TextInput, Text, StyleSheet } from "react-native";
{/* Apenas a caixa de pesquisa */}
export default function SearchBox({ value, onChangeText, placeholder }) {
  return (
    
    <View style={styles.searchBox}>
      <Text style={styles.searchIcon}>Search</Text>
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#acacac",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 160,
  },
  searchIcon: {
    fontSize: 12,
    marginRight: 6,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
    outlineStyle: "none",
  },
});
