import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { ActivityIndicator, View } from "react-native";

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Inter: require("../assets/fonts/Inter-VariableFont_opsz,wght.ttf"),
    InterItalic: require("../assets/fonts/Inter-Italic-VariableFont_opsz,wght.ttf"),
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="tela_inicial" options={{ headerShown: false }} />
      <Stack.Screen name="estoque" options={{ headerShown: false }} />
      <Stack.Screen name="usuarios" options={{ headerShown: false }} />
      <Stack.Screen name="materiais" options={{ headerShown: false }} />
      <Stack.Screen name="movimentacoes" options={{ headerShown: false }} />
      <Stack.Screen name="solicitacoes" options={{ headerShown: false }} />
    </Stack>
  );
}
