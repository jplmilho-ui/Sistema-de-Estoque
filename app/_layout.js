import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="tela_inicial" options={{ headerShown: false }} />
      <Stack.Screen name="estoque" options={{ headerShown: false }} />
      <Stack.Screen name="cadastro" options={{ headerShown: false }} />
      <Stack.Screen name="usuarios" options={{ headerShown: false }} />

    </Stack>
  );
}