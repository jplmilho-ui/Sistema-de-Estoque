//Caixa de busca que pode ser reutilizada apenas.
import { View, TextInput, StyleSheet } from "react-native";
import Icon from "./Icon";
export default function SearchBox({ value, onChangeText, placeholder }) {
  return (

    <View style={styles.searchBox}>
      <View style={styles.searchIcon}>
        <Icon name="search" size={16} color="#80868b" />
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor="#5f6368"
        value={value}
        onChangeText={onChangeText}
        accessible={true}
        accessibilityLabel={placeholder || "Campo de busca"}
        accessibilityHint="Digite o termo para filtrar a lista"
        accessibilityRole="search"
        returnKeyType="search"
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    // A busca é uma das funções principais das telas: fica mais larga
    // (240 px), mas ainda encolhe em telas bem estreitas.
    width: 240,
    minWidth: 160,
    flexShrink: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    // Sem isso, um placeholder comprido "empurra" a caixa e estoura o
    // container (o bug do texto vazando pra fora do balão arredondado).
    // Flex items na web têm min-width:auto por padrão — precisa zerar.
    minWidth: 0,
    fontSize: 16,
    padding: 0,
    outlineStyle: "none",
  },
});
