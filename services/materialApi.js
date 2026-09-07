// services/materialApi.js
//
// Ainda não existe backend para materiais, então este arquivo simula
// as chamadas de API guardando os dados em memória (dentro do próprio
// módulo). Os dados são perdidos sempre que o app recarrega.
//
// Quando o backend estiver pronto, basta trocar o CONTEÚDO de cada
// função por uma chamada fetch/axios de verdade. As telas que usam
// este arquivo (materiais.js) não precisam mudar nada.
//
//   listMaterials(token)              -> { materials: [...] }
//   createMaterial(token, dados)      -> { material: {...} }
//   updateMaterial(token, id, dados)  -> { material: {...} }
//   setMaterialActive(token, id, bool)-> { material: {...} }
//   deleteMaterial(token, id)         -> { success: true }
//
// MODELO DE QUANTIDADE POR UNIDADE DE MEDIDA
// -------------------------------------------
// Em vez de guardar só um número solto, cada material guarda:
//   - unidadeMedida:   "Unidade", "Caixa", "Pacote" ou um nome customizado
//   - fatorConversao:  quantas unidades individuais tem em 1 "unidadeMedida"
//                       (ex: 1 caixa = 50 unidades -> fatorConversao = 50)
//   - quantidade:      quantas "unidadeMedida" existem em estoque
//                       (ex: 4 caixas -> quantidade = 4)
//   - quantidadeTotal: quantidade * fatorConversao, já calculado e salvo,
//                       para facilitar comparações (ex: RF005 - reposição)
//
// Quando unidadeMedida === "Unidade", fatorConversao é sempre 1, então
// quantidade e quantidadeTotal acabam sendo o mesmo número.

const SIMULATED_DELAY = 400; // ms, só para simular latência de rede

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// Recebe o que vier do formulário e devolve um objeto de material
// já com os números normalizados e o total calculado.
function normalizePayload(data) {
  const unidadeMedida = data.unidadeMedida?.trim() || "Unidade";

  // Se a unidade for "Unidade", não faz sentido ter fator de conversão,
  // então forçamos 1 mesmo que o formulário mande outra coisa.
  const fatorConversao =
    unidadeMedida === "Unidade" ? 1 : Number(data.fatorConversao) || 1;

  const quantidade = Number(data.quantidade) || 0;

  return {
    nome: data.nome.trim(),
    categoria: data.categoria,
    unidadeMedida,
    fatorConversao,
    quantidade,
    quantidadeTotal: quantidade * fatorConversao,
    validade: data.validade?.trim() || "",
    ca: data.ca?.trim() || "",
  };
}

// "Banco de dados" em memória, só para dar pra testar a tela.
let materials = [
  {
    id: generateId(),
    ...normalizePayload({
      nome: "Luvas de procedimento",
      categoria: "EPI",
      unidadeMedida: "Caixa",
      fatorConversao: 50, // 1 caixa = 50 unidades
      quantidade: 4, // 4 caixas em estoque = 200 luvas
      validade: "10/12/2026",
      ca: "12345",
    }),
    ativo: true,
  },
  {
    id: generateId(),
    ...normalizePayload({
      nome: "Jaleco",
      categoria: "Uniforme",
      unidadeMedida: "Unidade",
      fatorConversao: 1,
      quantidade: 15,
      validade: "",
      ca: "",
    }),
    ativo: true,
  },
  {
    id: generateId(),
    ...normalizePayload({
      nome: "Máscara descartável",
      categoria: "EPI",
      unidadeMedida: "Caixa",
      fatorConversao: 100, // 1 caixa = 100 unidades
      quantidade: 0,
      validade: "01/10/2026",
      ca: "67890",
    }),
    ativo: false,
  },
];

export async function listMaterials(token) {
  await delay(SIMULATED_DELAY);
  // Devolve uma cópia para evitar mutação acidental por fora do módulo
  return { materials: materials.map((item) => ({ ...item })) };
}

export async function createMaterial(token, data) {
  await delay(SIMULATED_DELAY);

  const newMaterial = {
    id: generateId(),
    ...normalizePayload(data),
    ativo: true,
  };

  materials = [...materials, newMaterial];

  return { material: newMaterial };
}

export async function updateMaterial(token, id, data) {
  await delay(SIMULATED_DELAY);

  let updated = null;

  materials = materials.map((item) => {
    if (item.id !== id) return item;

    updated = {
      ...item,
      ...normalizePayload(data),
    };

    return updated;
  });

  if (!updated) {
    throw new Error("Material não encontrado.");
  }

  return { material: updated };
}

export async function setMaterialActive(token, id, ativo) {
  await delay(SIMULATED_DELAY);

  let updated = null;

  materials = materials.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, ativo };
    return updated;
  });

  if (!updated) {
    throw new Error("Material não encontrado.");
  }

  return { material: updated };
}

export async function deleteMaterial(token, id) {
  await delay(SIMULATED_DELAY);

  const exists = materials.some((item) => item.id === id);
  if (!exists) {
    throw new Error("Material não encontrado.");
  }

  materials = materials.filter((item) => item.id !== id);

  return { success: true };
}