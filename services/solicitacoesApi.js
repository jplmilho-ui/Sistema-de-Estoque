// services/solicitacoesApi.js
//
// Chamadas de /solicitacoes (pedidos de material feitos pelo aluno).
//
// Aluno:
//   listMateriaisDisponiveis(token)            -> { materiais }
//   listMinhasSolicitacoes(token)              -> { solicitacoes }
//   criarSolicitacao(token, dados)             -> { solicitacao }
//   cancelarSolicitacao(token, id)             -> { solicitacao }
//
// Admin / coordenador / professor (usadas pelas notificações):
//   listSolicitacoes(token)                    -> { solicitacoes }  (pendentes + respostas recentes)
//   aprovarSolicitacao(token, id)              -> { solicitacao }   (baixa o estoque)
//   recusarSolicitacao(token, id, motivo)      -> { solicitacao }

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

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ----- Aluno -----

export async function listMateriaisDisponiveis(token) {
  const response = await fetch(`${API_URL}/solicitacoes/materiais-disponiveis`, {
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

export async function listMinhasSolicitacoes(token) {
  const response = await fetch(`${API_URL}/solicitacoes/minhas`, {
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

// unidade: "embalagem" (ex: caixas, padrão) ou "unidade" (avulsas).
export async function criarSolicitacao(token, { materialId, quantidade, unidade = "embalagem", observacao }) {
  const response = await fetch(`${API_URL}/solicitacoes`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ materialId, quantidade, unidade, observacao }),
  });
  return parseResponse(response);
}

export async function cancelarSolicitacao(token, id) {
  const response = await fetch(`${API_URL}/solicitacoes/${id}/cancelar`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

// ----- Admin / coordenador / professor -----

export async function listSolicitacoes(token) {
  const response = await fetch(`${API_URL}/solicitacoes`, {
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

export async function aprovarSolicitacao(token, id) {
  const response = await fetch(`${API_URL}/solicitacoes/${id}/aprovar`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

export async function recusarSolicitacao(token, id, motivo) {
  const response = await fetch(`${API_URL}/solicitacoes/${id}/recusar`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ motivo }),
  });
  return parseResponse(response);
}
