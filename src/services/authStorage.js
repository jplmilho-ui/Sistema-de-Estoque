//Guarda o token/usuário no dispositivo
import AsyncStorage from "@react-native-async-storage/async-storage";

// As chaves têm sufixo de versão ("v2") de propósito: depois da troca dos
// nomes dos níveis de acesso (admin/coordenador), uma sessão antiga ainda
// guardada no aparelho traria o papel com o significado ANTIGO (o "admin"
// de antes é o "coordenador" de agora). Mudar a chave invalida essas
// sessões e obriga um novo login, já com o papel correto.
const TOKEN_KEY = "@estoque:token:v2";
const USER_KEY = "@estoque:user:v2";

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
