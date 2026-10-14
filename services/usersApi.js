//Chamadas CRUD de usuários
import { API_URL } from "./api";

async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    // resposta sem corpo JSON
  }

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível completar a operação.");
  }

  return data;
}

export async function listUsers(token) {
  const response = await fetch(`${API_URL}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response); // { users }
}

export async function createUser(token, { name, email, password, role, rm }) {
  const response = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, email, password, role, rm }),
  });
  return parseResponse(response); // { user }
}

// Desativa (ativo = false) ou reativa (ativo = true) uma conta. O histórico
// da conta é mantido; quem está logado nela é desconectado na hora.
export async function setUserActive(token, id, ativo) {
  const response = await fetch(`${API_URL}/users/${id}/ativo`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ativo }),
  });
  return parseResponse(response); // { user }
}

// Redefine a senha de OUTRA pessoa (admin: qualquer um; coordenador: professor
// e aluno). A própria senha é trocada no perfil (services/authApi.js).
export async function resetUserPassword(token, id, { password }) {
  const response = await fetch(`${API_URL}/users/${id}/senha`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
  return parseResponse(response); // { user }
}

export async function deleteUser(token, id) {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}
