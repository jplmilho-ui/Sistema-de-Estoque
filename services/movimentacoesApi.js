// services/movimentacoesApi.js
//
// RF004 - Consultar movimentações: histórico de entradas e saídas do
// estoque, com data e responsável.
//
// Cada retirada/devolução feita em materialApi.js (retirarMaterial /
// devolverMaterial) já cria esse registro automaticamente no backend —
// esta tela só lê o histórico, não tem ação de criar nada por aqui.

import { API_URL } from "./api";

async function parseResponse(response) {
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

export async function listMovimentacoes(token) {
  const response = await fetch(`${API_URL}/movimentacoes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response); // { movimentacoes }
}
