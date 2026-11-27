// Envolve uma tabela (linhas com colunas lado a lado) para que, em telas
// estreitas, ela mantenha uma largura mínima legível e role para o lado em
// vez de espremer as colunas. Em telas largas ocupa 100% normalmente.
import { ScrollView, View } from "react-native";

export default function TabelaRolavel({ children, larguraMinima = 760 }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View style={{ flexGrow: 1, minWidth: larguraMinima }}>{children}</View>
    </ScrollView>
  );
}
