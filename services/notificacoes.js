// services/notificacoes.js
//
// Monta a lista de notificações do sino da barra superior.
//
// Ainda não existe um endpoint de notificações no backend, então elas são
// DERIVADAS dos dados que o sistema já tem.
//
// ADMIN / COORDENADOR / PROFESSOR recebem, nesta ordem de prioridade:
//   Solicitações de alunos (PRIORIDADE)
//     - pedidos pendentes, com os botões Aprovar / Recusar
//     - respostas recentes ("Aprovada por Fulano"), só informativas
//   Pedidos de empréstimo de uniforme (PRIORIDADE)
//     - pedidos aguardando confirmação, com os botões Aprovar / Recusar
//       (aprovar = confirmar o empréstimo: o uniforme sai do estoque)
//   Uniformes não devolvidos
//     - empréstimo de aluno cuja data de devolução já passou, com link
//       para Estoque > aba "Empréstimos de uniforme" (onde a devolução é
//       registrada)
//   Alertas
//     - material vencido
//     - material que vence nos próximos 30 dias (mesma janela do resumo
//       da Tela Inicial)
//     - material sem estoque (quantidade 0)
//   Movimentações recentes
//     - as últimas entradas/saídas de estoque
//
// ALUNO recebe SOMENTE:
//   - aviso de que uma solicitação dele foi aprovada
//   - aviso de que um pedido de empréstimo de uniforme foi confirmado
//     (pode retirar) ou recusado
//   - aviso de devolução de uniforme: nos 2 dias antes do prazo (e no dia)
//     e, depois, enquanto estiver atrasado
//
// "Lida / não lida" é guardado no aparelho (AsyncStorage), por usuário.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { listMaterials } from "./materialApi";
import { listMovimentacoes } from "./movimentacoesApi";
import { listSolicitacoes, listMinhasSolicitacoes } from "./solicitacoesApi";
import { listEmprestimos, listMeusEmprestimos } from "./emprestimosApi";
import { parseDataBR, isVencido } from "../utils/validade";

const DIAS_ALERTA_VALIDADE = 30;
const MAX_MOVIMENTACOES = 10;
const MAX_LIDAS_GUARDADAS = 500;
const MAX_APROVACOES_ALUNO = 10;
const DIAS_APROVACOES_ALUNO = 30;

const MS_DIA = 24 * 60 * 60 * 1000;

function lidasKey(userId) {
  return `@estoque:notificacoes-lidas:${userId}`;
}

export async function getLidas(userId) {
  try {
    const raw = await AsyncStorage.getItem(lidasKey(userId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
}

export async function saveLidas(userId, lidas) {
  try {
    const lista = Array.from(lidas).slice(-MAX_LIDAS_GUARDADAS);
    await AsyncStorage.setItem(lidasKey(userId), JSON.stringify(lista));
  } catch (e) {
    // sem persistência o sino continua funcionando, só "esquece" o que foi lido
  }
}

// Diferença em dias entre hoje e uma data (negativo = já passou).
function diffDias(data) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(data);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / MS_DIA);
}

// "DD/MM/AAAA HH:mm" (formato que o backend manda nas movimentações) -> Date
function parseDataHoraBR(texto) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(texto || "");
  if (!match) return null;
  const [, dia, mes, ano, hora, min] = match.map(Number);
  const data = new Date(ano, mes - 1, dia, hora, min);
  return Number.isNaN(data.getTime()) ? null : data;
}

// "há 5 min", "há 3 h", "ontem", "há 4 dias" ou a data, se for antiga.
export function tempoRelativo(data) {
  if (!data) return "";
  const minutos = Math.floor((Date.now() - data.getTime()) / 60000);
  if (minutos < 1) return "agora há pouco";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.abs(diffDias(data));
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return data.toLocaleDateString("pt-BR");
}

function plural(n, singular, pluralTxt) {
  return n === 1 ? singular : pluralTxt;
}

function montarAlertas(materials) {
  const vencidos = [];
  const proximos = [];
  const semEstoque = [];

  materials.forEach((material) => {
    if (!material.ativo) return;

    const validade = parseDataBR(material.validade);

    if (validade && isVencido(material.validade)) {
      const dias = Math.abs(diffDias(validade));
      vencidos.push({
        ordem: validade.getTime(),
        item: {
          id: `vencido:${material.id}:${material.validade}`,
          grupo: "alertas",
          tipo: "vencido",
          title: `${material.nome} está vencido`,
          message: `Validade: ${material.validade}. Retire do uso e confira o estoque.`,
          timeLabel: `Venceu há ${dias} ${plural(dias, "dia", "dias")}`,
          href: "/estoque",
          params: { filtro: "vencidos" },
        },
      });
    } else if (validade) {
      const dias = diffDias(validade);
      if (dias <= DIAS_ALERTA_VALIDADE) {
        const quando =
          dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence em ${dias} dias`;
        proximos.push({
          ordem: validade.getTime(),
          item: {
            id: `proximo:${material.id}:${material.validade}`,
            grupo: "alertas",
            tipo: "proximo",
            title: `${material.nome} está perto de vencer`,
            message: `Validade: ${material.validade}.`,
            timeLabel: quando,
            href: "/estoque",
          },
        });
      }
    }

    if (material.quantidadeTotal <= 0) {
      semEstoque.push({
        ordem: 0,
        item: {
          id: `sem-estoque:${material.id}`,
          grupo: "alertas",
          tipo: "sem-estoque",
          title: `${material.nome} está sem estoque`,
          message: "Não há mais unidades disponíveis deste material.",
          timeLabel: "Reposição necessária",
          href: "/estoque",
        },
      });
    }
  });

  // vencidos: os que venceram há mais tempo primeiro; próximos: o que
  // vence antes primeiro.
  vencidos.sort((a, b) => a.ordem - b.ordem);
  proximos.sort((a, b) => a.ordem - b.ordem);

  return [...vencidos, ...proximos, ...semEstoque].map((entry) => entry.item);
}

function montarMovimentacoes(movimentacoes) {
  return movimentacoes.slice(0, MAX_MOVIMENTACOES).map((mov) => {
    const tipo = mov.tipo === "entrada" || mov.tipo === "devolucao" ? mov.tipo : "saida";
    const verbo =
      tipo === "entrada" ? "adicionou" : tipo === "devolucao" ? "recebeu de volta" : "retirou";
    return {
      id: `mov:${mov.id}`,
      grupo: "movimentacoes",
      tipo,
      title: `${mov.materialNome}`,
      message: `${mov.responsavel} ${verbo} ${mov.quantidade}.`,
      // dataISO = instante exato (certo em qualquer fuso). O texto "DD/MM/AAAA
      // HH:mm" fica só como reserva, caso o servidor ainda não mande dataISO.
      timeLabel:
        tempoRelativo(mov.dataISO ? new Date(mov.dataISO) : parseDataHoraBR(mov.data)) ||
        mov.data,
      href: "/movimentacoes",
    };
  });
}

// ---------------------------------------------------------------
// SOLICITAÇÕES
// ---------------------------------------------------------------

// Equipe (admin/coordenador/professor): pedidos pendentes primeiro (com
// ações), depois as respostas recentes (só informativas).
function montarSolicitacoesEquipe(solicitacoes) {
  const itens = solicitacoes.map((sol) => {
    const detalhe = [
      sol.quantidadeTexto,
      sol.alunoRm ? `RM ${sol.alunoRm}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    if (sol.status === "pendente") {
      return {
        id: `sol:${sol.id}`,
        grupo: "solicitacoes",
        tipo: "solicitacao",
        solicitacaoId: sol.id,
        title: `${sol.alunoNome} solicitou ${sol.materialNome}`,
        message: sol.observacao ? `${detalhe} — "${sol.observacao}"` : detalhe,
        timeLabel: tempoRelativo(new Date(sol.criadoEm)),
      };
    }

    const aprovada = sol.status === "aprovada";
    return {
      id: `solresp:${sol.id}`,
      grupo: "solicitacoes",
      tipo: aprovada ? "aprovada" : "recusada",
      // já foi resolvida por alguém: não conta como "não lida"
      lidaPorPadrao: true,
      title: `Pedido de ${sol.alunoNome} (${sol.materialNome}) ${aprovada ? "aprovado" : "recusado"}`,
      message: `${aprovada ? "Aprovado" : "Recusado"} por ${sol.respondidoPorNome}.`,
      timeLabel: tempoRelativo(new Date(sol.respondidoEm)),
    };
  });

  // pendentes antes das respondidas (a ordem original de cada grupo é mantida)
  return [
    ...itens.filter((item) => item.tipo === "solicitacao"),
    ...itens.filter((item) => item.tipo !== "solicitacao"),
  ];
}

// Aluno: SOMENTE avisos de solicitação aprovada.
function montarAprovacoesAluno(solicitacoes) {
  const limite = Date.now() - DIAS_APROVACOES_ALUNO * MS_DIA;

  return solicitacoes
    .filter((sol) => sol.status === "aprovada" && sol.respondidoEm)
    .filter((sol) => new Date(sol.respondidoEm).getTime() >= limite)
    .sort((a, b) => new Date(b.respondidoEm) - new Date(a.respondidoEm))
    .slice(0, MAX_APROVACOES_ALUNO)
    .map((sol) => ({
      id: `aprovada:${sol.id}`,
      grupo: "solicitacoes",
      tipo: "aprovada",
      title: `Sua solicitação de ${sol.materialNome} foi aprovada`,
      message: `${sol.quantidadeTexto} — aprovada por ${sol.respondidoPorNome}.`,
      timeLabel: tempoRelativo(new Date(sol.respondidoEm)),
      href: "/solicitacoes",
    }));
}

// ---------------------------------------------------------------
// EMPRÉSTIMOS DE UNIFORME
// ---------------------------------------------------------------

function textoAtraso(dias) {
  const n = Math.abs(dias);
  return `Atrasado há ${n} ${plural(n, "dia", "dias")}`;
}

function textoVencimento(dias) {
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Vence em ${dias} dias`;
}

// Aluno: devoluções chegando (até 2 dias antes, vem do backend em
// `venceEmBreve`) e atrasadas. O id do aviso de prazo inclui os dias que
// faltam, então a cada dia o aviso volta como NÃO lido ("vence em 2 dias"
// -> "vence amanhã" -> "vence hoje").
function montarEmprestimosAluno(emprestimos) {
  return emprestimos
    .filter((e) => e.status === "emprestado" && (e.atrasado || e.venceEmBreve))
    .sort((a, b) => a.diasParaDevolucao - b.diasParaDevolucao)
    .map((e) =>
      e.atrasado
        ? {
            id: `emp-atraso:${e.id}`,
            grupo: "emprestimos",
            tipo: "emprestimo-atrasado",
            title: `Devolução atrasada: ${e.materialNome}`,
            message: `O prazo era ${e.dataDevolucao}. Leve o uniforme à coordenação o quanto antes.`,
            timeLabel: textoAtraso(e.diasParaDevolucao),
            href: "/solicitacoes",
          }
        : {
            id: `emp-prazo:${e.id}:${e.diasParaDevolucao}`,
            grupo: "emprestimos",
            tipo: "emprestimo-prazo",
            title: `Devolva ${e.materialNome} até ${e.dataDevolucao}`,
            message: `${e.quantidadeTexto} emprestado(s). Não esqueça de levar na data combinada.`,
            timeLabel: textoVencimento(e.diasParaDevolucao),
            href: "/solicitacoes",
          }
    );
}

// Aluno: respostas aos pedidos de empréstimo (confirmado / recusado) dos
// últimos dias. Confirmado só aparece enquanto o uniforme está com ele: o
// aviso de prazo assume daí em diante.
function montarRespostasEmprestimoAluno(emprestimos) {
  const limite = Date.now() - DIAS_APROVACOES_ALUNO * MS_DIA;

  return emprestimos
    .filter((e) => (e.status === "emprestado" || e.status === "recusado") && e.respondidoEm)
    .filter((e) => new Date(e.respondidoEm).getTime() >= limite)
    .sort((a, b) => new Date(b.respondidoEm) - new Date(a.respondidoEm))
    .slice(0, MAX_APROVACOES_ALUNO)
    .map((e) =>
      e.status === "emprestado"
        ? {
            id: `emp-confirmado:${e.id}`,
            grupo: "solicitacoes",
            tipo: "aprovada",
            title: `Seu empréstimo de ${e.materialNome} foi confirmado`,
            message: `${e.quantidadeTexto} — confirmado por ${e.respondidoPorNome}. Pode retirar o uniforme e devolver até ${e.dataDevolucao}.`,
            timeLabel: tempoRelativo(new Date(e.respondidoEm)),
            href: "/solicitacoes",
          }
        : {
            id: `emp-recusado:${e.id}`,
            grupo: "solicitacoes",
            tipo: "recusada",
            title: `Seu pedido de empréstimo de ${e.materialNome} foi recusado`,
            message: e.motivoRecusa
              ? `Recusado por ${e.respondidoPorNome}. Motivo: ${e.motivoRecusa}`
              : `Recusado por ${e.respondidoPorNome}.`,
            timeLabel: tempoRelativo(new Date(e.respondidoEm)),
            href: "/solicitacoes",
          }
    );
}

// Equipe: pedidos de empréstimo AGUARDANDO confirmação (com Aprovar /
// Recusar no sino), do mais antigo para o mais novo.
function montarPedidosEmprestimoEquipe(emprestimos) {
  return emprestimos
    .filter((e) => e.status === "pendente")
    .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm))
    .map((e) => {
      const detalhe = [
        e.quantidadeTexto,
        e.alunoRm ? `RM ${e.alunoRm}` : null,
        `devolução até ${e.dataDevolucao}`,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        id: `emp-pedido:${e.id}`,
        grupo: "solicitacoes",
        // "solicitacao" é o tipo que mostra os botões Aprovar / Recusar
        tipo: "solicitacao",
        emprestimoId: e.id,
        title: `${e.alunoNome} pediu emprestado ${e.materialNome}`,
        message: e.observacao ? `${detalhe} — "${e.observacao}"` : detalhe,
        timeLabel: tempoRelativo(new Date(e.criadoEm)),
      };
    });
}

// Equipe (admin/coordenador/professor): só o que NÃO foi devolvido e já
// passou do prazo, do mais atrasado para o menos.
function montarEmprestimosEquipe(emprestimos) {
  return emprestimos
    .filter((e) => e.status === "emprestado" && e.atrasado)
    .sort((a, b) => a.diasParaDevolucao - b.diasParaDevolucao)
    .map((e) => ({
      id: `emp-atraso:${e.id}`,
      grupo: "emprestimos",
      tipo: "emprestimo-atrasado",
      title: `${e.alunoNome} ainda não devolveu ${e.materialNome}`,
      message: [e.quantidadeTexto, e.alunoRm ? `RM ${e.alunoRm}` : null, `prazo ${e.dataDevolucao}`]
        .filter(Boolean)
        .join(" · "),
      timeLabel: textoAtraso(e.diasParaDevolucao),
      href: "/estoque",
      params: { aba: "emprestimos", filtro: "atrasados" },
    }));
}

// Busca os dados do perfil logado e devolve:
//   { items, completo, falhou }
// "completo" é false se alguma busca falhou — nesse caso quem chama não
// deve "limpar" o histórico de lidas (senão uma falha de rede faria
// notificações antigas voltarem como não lidas).
export async function carregarNotificacoes(token, role) {
  // ----- ALUNO: aprovações das próprias solicitações + prazos de devolução -----
  if (role === "aluno") {
    const [solRes, empRes] = await Promise.allSettled([
      listMinhasSolicitacoes(token),
      listMeusEmprestimos(token),
    ]);

    if (solRes.status !== "fulfilled" && empRes.status !== "fulfilled") {
      return { items: [], completo: false, falhou: true };
    }

    const aprovacoes =
      solRes.status === "fulfilled"
        ? montarAprovacoesAluno(solRes.value.solicitacoes || [])
        : [];
    const devolucoes =
      empRes.status === "fulfilled"
        ? montarEmprestimosAluno(empRes.value.emprestimos || [])
        : [];
    const respostasEmprestimo =
      empRes.status === "fulfilled"
        ? montarRespostasEmprestimoAluno(empRes.value.emprestimos || [])
        : [];

    return {
      // prazos de devolução primeiro (o grupo também é ordenado no pop-up)
      items: [...devolucoes, ...respostasEmprestimo, ...aprovacoes],
      completo: solRes.status === "fulfilled" && empRes.status === "fulfilled",
      falhou: false,
    };
  }

  // ----- ADMIN / COORDENADOR / PROFESSOR -----
  const [materiaisRes, movsRes, solRes, empRes] = await Promise.allSettled([
    listMaterials(token, { ativo: true }),
    listMovimentacoes(token),
    listSolicitacoes(token),
    listEmprestimos(token),
  ]);

  const materiaisOk = materiaisRes.status === "fulfilled";
  const movsOk = movsRes.status === "fulfilled";
  const solOk = solRes.status === "fulfilled";
  const empOk = empRes.status === "fulfilled";

  // Quem não tem permissão pra ver materiais simplesmente não recebe os
  // alertas — isso não é um erro da tela.
  const materialsPermitido =
    materiaisOk || /permiss/i.test(materiaisRes.reason?.message || "");

  if (!materiaisOk && !movsOk && !solOk && !empOk) {
    throw solRes.reason || movsRes.reason || materiaisRes.reason;
  }

  const solicitacoes = solOk ? montarSolicitacoesEquipe(solRes.value.solicitacoes || []) : [];
  const emprestimos = empOk ? montarEmprestimosEquipe(empRes.value.emprestimos || []) : [];
  const pedidosEmprestimo = empOk
    ? montarPedidosEmprestimoEquipe(empRes.value.emprestimos || [])
    : [];
  const alertas = materiaisOk ? montarAlertas(materiaisRes.value.materials || []) : [];
  const movs = movsOk ? montarMovimentacoes(movsRes.value.movimentacoes || []) : [];

  return {
    // solicitações de alunos e pedidos de empréstimo vêm primeiro
    // (prioridade), depois os uniformes não devolvidos
    items: [...solicitacoes, ...pedidosEmprestimo, ...emprestimos, ...alertas, ...movs],
    completo: (materiaisOk || materialsPermitido) && movsOk && solOk && empOk,
    falhou: false,
  };
}
