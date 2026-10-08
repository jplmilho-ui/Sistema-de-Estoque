// utils/movimentacoesPdf.js
//
// Tudo que a tela de Movimentações precisa pra gerar o PDF:
//   - máscara e validação das datas digitadas (DD/MM/AAAA)
//   - filtro das movimentações por período
//   - montagem do PDF (mesma tabela e mesmas colunas que aparecem na tela)
//   - download do arquivo no navegador
//
// Deixei isso fora do app/movimentacoes.js pra tela não ficar gigante e
// porque essa parte não depende de React Native (dá pra testar em Node).
//
// Obs: o PDF só usa caracteres do alfabeto Latin-1 (acentos do português
// funcionam normal). Evitei "—", "•" e "…" de propósito: a fonte padrão do
// PDF (Helvetica) não desenha esses símbolos de forma confiável.

import autoTable from "jspdf-autotable";
import {
  criarDocumento,
  medidas,
  desenharCabecalho,
  desenharTitulo,
  desenharCampos,
  desenharRodape,
  estiloTabela,
} from "./pdfBase";
import { formatarDataBR, mascararData } from "./datas";

// A tela de Movimentações importa estas funções daqui; elas agora moram em
// utils/datas.js e utils/pdfBase.js (compartilhadas com os outros PDFs).
export { formatarDataBR, mascararData };
export { baixarPdf } from "./pdfBase";

// ---------------------------------------------------------------------
// Datas
//
// Internamente cada data vira um número AAAAMMDD (ex: 20260910). Assim dá
// pra comparar "antes/depois" com um simples < ou >, sem se preocupar com
// fuso horário nem com hora do dia.
// ---------------------------------------------------------------------

function paraChave(ano, mes, dia) {
  return ano * 10000 + mes * 100 + dia;
}

// Devolve "DD/MM/AAAA" a partir de um número AAAAMMDD.
export function chaveParaBR(chave) {
  const ano = Math.floor(chave / 10000);
  const mes = Math.floor((chave % 10000) / 100);
  const dia = chave % 100;
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

// Lê "DD/MM/AAAA" com validação de calendário de verdade: 31/02/2026
// é rejeitado (o `new Date` sozinho aceitaria e "viraria" 03/03).
function lerDataEstrita(texto) {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!partes) return null;

  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const ano = Number(partes[3]);
  if (ano < 1900) return null;

  const data = new Date(ano, mes - 1, dia);
  const existe =
    data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia;

  return existe ? paraChave(ano, mes, dia) : null;
}

// A data que vem do backend é "DD/MM/AAAA HH:mm" (a mesma que aparece na
// tela). Aqui só interessa o dia.
function chaveDaMovimentacao(item) {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(item?.data ?? "");
  if (!partes) return null;
  return paraChave(Number(partes[3]), Number(partes[2]), Number(partes[1]));
}

function interpretarCampo(texto) {
  const valor = (texto ?? "").trim();
  if (valor === "") return { estado: "vazio", chave: null };
  if (valor.length < 10) return { estado: "incompleto", chave: null };

  const chave = lerDataEstrita(valor);
  return chave === null
    ? { estado: "invalido", chave: null }
    : { estado: "ok", chave };
}

// Analisa os dois campos de data do modal.
//   - campo vazio = sem limite naquele lado (data final vazia = "até agora")
//   - `incompleto`: a pessoa ainda está digitando (não mostra erro ainda)
//   - `erro`: texto pronto pra mostrar na tela
// Devolve { ok, incompleto, erro, inicio, fim } — inicio/fim em AAAAMMDD.
export function interpretarPeriodo(inicioTexto, fimTexto) {
  const inicio = interpretarCampo(inicioTexto);
  const fim = interpretarCampo(fimTexto);

  let erro = "";
  if (inicio.estado === "invalido") {
    erro = "Data inicial inválida. Confira o dia e o mês.";
  } else if (fim.estado === "invalido") {
    erro = "Data final inválida. Confira o dia e o mês.";
  } else if (
    inicio.estado === "ok" &&
    fim.estado === "ok" &&
    inicio.chave > fim.chave
  ) {
    erro = "A data inicial não pode ser depois da data final.";
  }

  const incompleto =
    inicio.estado === "incompleto" || fim.estado === "incompleto";

  return {
    ok: !erro && !incompleto,
    incompleto,
    erro,
    inicio: inicio.chave,
    fim: fim.chave,
  };
}

// Mantém só as movimentações dentro do período (as duas pontas entram).
// Sem início e sem fim, devolve a lista inteira. Se houver período e a
// data de alguma movimentação não puder ser lida, ela fica de fora.
export function filtrarPorPeriodo(movimentacoes, inicio, fim) {
  if (inicio === null && fim === null) return movimentacoes;

  return movimentacoes.filter((item) => {
    const dia = chaveDaMovimentacao(item);
    if (dia === null) return false;
    if (inicio !== null && dia < inicio) return false;
    if (fim !== null && dia > fim) return false;
    return true;
  });
}

// Texto do período que aparece no topo do PDF.
export function descreverPeriodo(inicio, fim) {
  if (inicio !== null && fim !== null) {
    return `De ${chaveParaBR(inicio)} até ${chaveParaBR(fim)}`;
  }
  if (inicio !== null) return `De ${chaveParaBR(inicio)} até agora`;
  if (fim !== null) return `Até ${chaveParaBR(fim)}`;
  return "Todo o período";
}

function montarNomeArquivo(inicio, fim, geradoEm) {
  const traco = (br) => br.split("/").join("-");
  const base = "relatorio-movimentacoes";

  if (inicio !== null && fim !== null) {
    return `${base}_${traco(chaveParaBR(inicio))}_a_${traco(chaveParaBR(fim))}.pdf`;
  }
  if (inicio !== null) {
    // Sem data final = "até agora", então o nome usa o dia de hoje.
    return `${base}_${traco(chaveParaBR(inicio))}_a_${traco(formatarDataBR(geradoEm))}.pdf`;
  }
  if (fim !== null) {
    return `${base}_ate_${traco(chaveParaBR(fim))}.pdf`;
  }
  return `${base}_${traco(formatarDataBR(geradoEm))}.pdf`;
}

// ---------------------------------------------------------------------
// PDF
//
// Visual minimalista e sem cores (é pra imprimir): cabeçalho institucional,
// título centralizado, dados do relatório e a tabela com as mesmas colunas
// que aparecem na tela. O relatório não tem campo de assinatura.
// ---------------------------------------------------------------------

// Mesma ordem e mesma proporção (flex) das colunas da tela.
const COLUNAS = [
  { titulo: "Data", flex: 1.3 },
  { titulo: "Material", flex: 1.8 },
  { titulo: "Tipo", flex: 1 },
  { titulo: "Quantidade", flex: 1.4 },
  { titulo: "Responsável", flex: 1.5 },
];

// Nome do tipo de movimentação como aparece na tela e no PDF.
function rotuloTipo(tipo) {
  if (tipo === "entrada") return "Entrada";
  if (tipo === "devolucao") return "Devolução";
  return "Saída";
}

// Corta textos muito grandes (ex: busca longa) pra não vazar da página.
function limitar(texto, max) {
  const t = String(texto ?? "");
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}

// Monta o PDF e devolve { doc, nomeArquivo }.
//
// opcoes:
//   movimentacoes  lista já filtrada, na mesma ordem da tela
//   inicio, fim    período em AAAAMMDD (ou null = sem limite)
//   tipo           "todas" | "entrada" | "saida" | "devolucao" (filtro da tela)
//   busca          texto da busca da tela ("" se vazio)
//   geradoEm       Date (padrão: agora)
export function gerarPdfMovimentacoes({
  movimentacoes,
  inicio = null,
  fim = null,
  tipo = "todas",
  busca = "",
  geradoEm = new Date(),
}) {
  const doc = criarDocumento("Relatório de Movimentações");
  const { util } = medidas(doc);

  const totalEntradas = movimentacoes.filter((m) => m.tipo === "entrada").length;
  const totalSaidas = movimentacoes.filter((m) => m.tipo === "saida").length;
  const totalDevolucoes = movimentacoes.filter((m) => m.tipo === "devolucao").length;

  let y = desenharCabecalho(doc);
  y = desenharTitulo(doc, "Relatório de Movimentações", y + 4);

  const tipoTexto =
    tipo === "entrada"
      ? "Entradas"
      : tipo === "saida"
        ? "Saídas"
        : tipo === "devolucao"
          ? "Devoluções"
          : "Todas";

  const campos = [
    ["Período", descreverPeriodo(inicio, fim)],
    ["Tipo", tipoTexto],
  ];
  if (busca) campos.push(["Busca", limitar(busca, 70)]);
  campos.push([
    "Total",
    `${movimentacoes.length} ${
      movimentacoes.length === 1 ? "movimentação" : "movimentações"
    } (${totalEntradas} ${totalEntradas === 1 ? "entrada" : "entradas"}, ${totalSaidas} ${
      totalSaidas === 1 ? "saída" : "saídas"
    }, ${totalDevolucoes} ${totalDevolucoes === 1 ? "devolução" : "devoluções"})`,
  ]);

  y = desenharCampos(doc, campos, y + 2, { colunaRotulo: 24 });

  // ----- Tabela (mesmas colunas da tela) -----
  const somaFlex = COLUNAS.reduce((soma, col) => soma + col.flex, 0);
  const columnStyles = {};
  COLUNAS.forEach((col, index) => {
    columnStyles[index] = { cellWidth: (util * col.flex) / somaFlex };
  });

  autoTable(doc, {
    ...estiloTabela(),
    startY: y + 4,
    head: [COLUNAS.map((col) => col.titulo)],
    body: movimentacoes.map((item) => [
      item.data ?? "",
      item.materialNome ?? "",
      rotuloTipo(item.tipo),
      item.quantidade ?? "",
      item.responsavel ?? "",
    ]),
    columnStyles,
  });

  desenharRodape(doc, "Sistema de Estoque - Relatório de Movimentações", geradoEm);

  return { doc, nomeArquivo: montarNomeArquivo(inicio, fim, geradoEm) };
}
