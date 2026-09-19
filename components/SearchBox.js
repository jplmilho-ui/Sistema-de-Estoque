//Caixa de busca que pode ser reutilizada apenas.
import { View, TextInput, Text, StyleSheet } from "react-native";
export default function SearchBox({ value, onChangeText, placeholder }) {
  return (

    <View style={styles.searchBox}>
      <Text style={styles.searchIcon}>🔍</Text>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 180,
    maxWidth: 260,
    flexShrink: 1,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    // Sem isso, um placeholder comprido "empurra" a caixa e estoura o
    // container (o bug do texto vazando pra fora do balão arredondado).
    // Flex items na web têm min-width:auto por padrão — precisa zerar.
    minWidth: 0,
    fontSize: 13,
    padding: 0,
    outlineStyle: "none",
  },
});
