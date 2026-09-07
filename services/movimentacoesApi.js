// services/movimentacoesApi.js
//
// RF004 - Consultar movimentações: histórico de entradas e saídas
// do estoque, com data e responsável.
//
// Ainda não existe backend pra isso, e as ações de "Adicionar item" /
// "Retirar item" em estoque.js (RF001/RF002) também ainda não registram
// nada de verdade — então esse arquivo simula os dados em memória, no
// mesmo padrão do materialApi.js.
//
// Quando RF001/RF002 forem implementados de verdade, o botão de
// adicionar/retirar item pode chamar registerMovimentacao pra já cair
// automaticamente nesse histórico. E quando o backend estiver pronto,
// é só trocar o conteúdo das funções por chamadas fetch reais.

const SIMULATED_DELAY = 400;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// "Banco de dados" em memória, só pra dar pra testar a tela.
// Mais recente primeiro.
let movimentacoes = [
  {
    id: generateId(),
    materialNome: "Luvas de procedimento",
    tipo: "entrada",
    quantidade: "2 caixas (100 un.)",
    data: "05/09/2026 14:32",
    responsavel: "Admin Souza",
  },
  {
    id: generateId(),
    materialNome: "Jaleco",
    tipo: "saida",
    quantidade: "3 un.",
    data: "04/09/2026 09:10",
    responsavel: "Prof. Ana Lima",
  },
  {
    id: generateId(),
    materialNome: "Seringas",
    tipo: "saida",
    quantidade: "10 un.",
    data: "03/09/2026 16:45",
    responsavel: "Prof. Carlos Melo",
  },
  {
    id: generateId(),
    materialNome: "Máscara descartável",
    tipo: "entrada",
    quantidade: "1 caixa (100 un.)",
    data: "01/09/2026 08:20",
    responsavel: "Admin Souza",
  },
  {
    id: generateId(),
    materialNome: "Luvas de procedimento",
    tipo: "saida",
    quantidade: "20 un.",
    data: "30/08/2026 11:05",
    responsavel: "Prof. Ana Lima",
  },
  {
    id: generateId(),
    materialNome: "Jaleco",
    tipo: "entrada",
    quantidade: "5 un.",
    data: "28/08/2026 13:50",
    responsavel: "Admin Souza",
  },
];

export async function listMovimentacoes(token) {
  await delay(SIMULATED_DELAY);
  return { movimentacoes: movimentacoes.map((item) => ({ ...item })) };
}

// Pronta pra usar quando RF001/RF002 forem implementados de verdade.
export async function registerMovimentacao(token, data) {
  await delay(SIMULATED_DELAY);

  const newMovimentacao = {
    id: generateId(),
    materialNome: data.materialNome,
    tipo: data.tipo, // "entrada" | "saida"
    quantidade: data.quantidade,
    data: data.data || new Date().toLocaleString("pt-BR"),
    responsavel: data.responsavel,
  };

  movimentacoes = [newMovimentacao, ...movimentacoes];

  return { movimentacao: newMovimentacao };
}