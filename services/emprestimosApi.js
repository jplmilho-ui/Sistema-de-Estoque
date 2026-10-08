// services/emprestimosApi.js
//
// Chamadas de /emprestimos (empréstimo de uniforme com data de devolução).
//
// Aluno:
//   listUniformesDisponiveis(token)            -> { materiais, regras }
//   listMeusEmprestimos(token)                 -> { emprestimos }
//   criarEmprestimo(token, dados)              -> { emprestimo }  (fica PENDENTE: só vale
//                                                  depois que a equipe confirmar)
//   cancelarEmprestimo(token, id)              -> { emprestimo }  (desiste de um pedido pendente)
//
// Admin / coordenador / professor:
//   listEmprestimos(token)                     -> { emprestimos }  (pendentes + em aberto + devolvidos recentes)
//   aprovarEmprestimo(token, id)               -> { emprestimo }   (confirma: baixa o estoque)
//   recusarEmprestimo(token, id, motivo)       -> { emprestimo }
//   devolverEmprestimo(token, id)              -> { emprestimo }   (o uniforme volta ao estoque)

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

export async function listUniformesDisponiveis(token) {
  const response = await fetch(`${API_URL}/emprestimos/materiais-disponiveis`, {
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

export async function listMeusEmprestimos(token) {
  const response = await fetch(`${API_URL}/emprestimos/minhas`, {
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

// dataDevolucao no formato "DD/MM/AAAA".
export async function criarEmprestimo(token, { materialId, quantidade, dataDevolucao, observacao }) {
  const response = await fetch(`${API_URL}/emprestimos`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ materialId, quantidade, dataDevolucao, observacao }),
  });
  return parseResponse(response);
}

export async function cancelarEmprestimo(token, id) {
  const response = await fetch(`${API_URL}/emprestimos/${id}/cancelar`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

// ----- Admin / coordenador / professor -----

export async function listEmprestimos(token) {
  const response = await fetch(`${API_URL}/emprestimos`, {
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

export async function aprovarEmprestimo(token, id) {
  const response = await fetch(`${API_URL}/emprestimos/${id}/aprovar`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

export async function recusarEmprestimo(token, id, motivo) {
  const response = await fetch(`${API_URL}/emprestimos/${id}/recusar`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ motivo }),
  });
  return parseResponse(response);
}

export async function devolverEmprestimo(token, id) {
  const response = await fetch(`${API_URL}/emprestimos/${id}/devolver`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return parseResponse(response);
}
