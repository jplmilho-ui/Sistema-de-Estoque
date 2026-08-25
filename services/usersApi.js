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

export async function createUser(token, { name, email, password, role }) {
  const response = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, email, password, role }),
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
