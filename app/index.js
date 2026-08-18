import { View, Text, Button } from "react-native";
import { router } from "expo-router";

{/* Tela breve antes de login, só para facilitar, será retirada */}
export default function App() {
  return (
    <View>
      <Text>APP</Text>

      <Button title="entrar" onPress={() => router.push("/login")} />
    </View>
  );
}
