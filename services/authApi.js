import { API_URL } from "./api";

async function parseResponse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    // resposta sem corpo JSON (ex: servidor fora do ar mandando HTML de erro)
  }

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível completar a operação.");
  }

  return data;
}

// Cadastro: chama POST /auth/register no backend, que já cria o usuário
// com a senha criptografada (bcrypt) no PostgreSQL via Prisma.
export async function registerUser(name, email, password) {
  let response;
  try {
    response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
  } catch (networkError) {
    throw new Error(
      "Não foi possível conectar ao servidor. Verifique se o backend está rodando."
    );
  }

  return parseResponse(response); // { user }
}

// Login: chama POST /auth/login, que busca o usuário no banco de dados,
// compara a senha com bcrypt.compare e devolve um token JWT.
export async function loginUser(email, password) {
  let response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (networkError) {
    throw new Error(
      "Não foi possível conectar ao servidor. Verifique se o backend está rodando."
    );
  }

  return parseResponse(response); // { user, token }
}
