//Guarda o token/usuário no dispositivo
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@estoque:token";
const USER_KEY = "@estoque:user";

export async function saveSession(token, user) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function getSession() {
  const values = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
  const map = Object.fromEntries(values);
  return {
    token: map[TOKEN_KEY] || null,
    user: map[USER_KEY] ? JSON.parse(map[USER_KEY]) : null,
  };
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}
