// services/materialApi.js
//
// Chamadas reais de CRUD de materiais + retirar/devolver estoque.
// (Antes este arquivo simulava tudo em memória — agora conversa de
// verdade com /materiais no backend.)
//
//   listMaterials(token)                    -> { materials: [...] }
//   createMaterial(token, dados)            -> { material: {...} }
//   updateMaterial(token, id, dados)        -> { material: {...} }
//   setMaterialActive(token, id, bool)      -> { material: {...} }
//   deleteMaterial(token, id)               -> null
//   retirarMaterial(token, id, quantidade, unidade)  -> { material, movimentacao }
//   devolverMaterial(token, id, quantidade, unidade) -> { material, movimentacao }
//     (unidade: "embalagem" = ex: caixas, padrão | "unidade" = avulsas)
//
// MODELO DE QUANTIDADE POR UNIDADE DE MEDIDA
// -------------------------------------------
// Em vez de guardar só um número solto, cada material guarda:
//   - unidadeMedida:   "Unidade", "Caixa", "Pacote" ou um nome customizado
//   - fatorConversao:  quantas unidades individuais tem em 1 "unidadeMedida"
//                       (ex: 1 caixa = 50 unidades -> fatorConversao = 50)
//   - quantidadeTotal: o saldo, SEMPRE em unidades (a fonte da verdade);
//   - quantidade:      embalagens FECHADAS (ex: 3 caixas), calculado pelo backend;
//   - unidadesAvulsas: o que sobra sem completar uma embalagem (ex: 12 un.);
//   - quantidadeTexto: texto pronto, ex: "3 caixas e 12 un. (162 un.)".
//
// "Retirar" e "adicionar" aceitam a quantidade em embalagens OU em unidades
// avulsas (parâmetro "unidade"), então dá para retirar 1 unidade de um item
// que vem em caixa. O saldo e o histórico são gravados em unidades.

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

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// params.ativo (opcional): true -> só materiais ativos (usado na tela de
// Estoque); false -> só inativos; omitido -> todos (usado na tela de
// Materiais, que precisa enxergar inativos também para poder reativar).
export async function listMaterials(token, params = {}) {
  const query = new URLSearchParams();
  if (params.ativo !== undefined) {
    query.set("ativo", String(params.ativo));
  }
  const queryString = query.toString();

  const response = await fetch(
    `${API_URL}/materiais${queryString ? `?${queryString}` : ""}`,
    { headers: authHeaders(token) }
  );
  return parseResponse(response);
}

export async function createMaterial(token, data) {
  const response = await fetch(`${API_URL}/materiais`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return parseResponse(response);
}

export async function updateMaterial(token, id, data) {
  const response = await fetch(`${API_URL}/materiais/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return parseResponse(response);
}

export async function setMaterialActive(token, id, ativo) {
  const response = await fetch(`${API_URL}/materiais/${id}/ativo`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ ativo }),
  });
  return parseResponse(response);
}

export async function deleteMaterial(token, id) {
  const response = await fetch(`${API_URL}/materiais/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return parseResponse(response);
}

// Retirar item do estoque: admin, coordenador e professor.
export async function retirarMaterial(token, id, quantidade, unidade = "embalagem") {
  const response = await fetch(`${API_URL}/materiais/${id}/retirar`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ quantidade, unidade }),
  });
  return parseResponse(response);
}

// Adicionar item ao estoque: admin, coordenador e professor.
export async function devolverMaterial(token, id, quantidade, unidade = "embalagem") {
  const response = await fetch(`${API_URL}/materiais/${id}/devolver`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ quantidade, unidade }),
  });
  return parseResponse(response);
}

// Resumo pra Tela Inicial: { totalCadastrados, divergencias, proximosDaValidade, auditados }
export async function getResumo(token) {
  const response = await fetch(`${API_URL}/materiais/resumo`, {
    headers: authHeaders(token),
  });
  return parseResponse(response);
}
