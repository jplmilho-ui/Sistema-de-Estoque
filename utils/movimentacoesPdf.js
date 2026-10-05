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

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

// Devolve "DD/MM/AAAA" a partir de um Date.
export function formatarDataBR(data) {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

// Máscara pro campo de data: o usuário digita só os números e a barra é
// colocada sozinha. "10092026" -> "10/09/2026".
export function mascararData(texto) {
  const numeros = String(texto ?? "").replace(/\D/g, "").slice(0, 8);

  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 4) return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
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
// ---------------------------------------------------------------------

// Cores iguais às da tela (app/movimentacoes.js), em [R, G, B].
const COR = {
  verdeEscuro: [27, 74, 59], // #1b4a3b
  textoPrincipal: [32, 33, 36], // #202124
  textoSuave: [95, 99, 104], // #5f6368
  fundoCabecalho: [245, 245, 245], // #f5f5f5
  linha: [238, 238, 238], // #eeeeee
  divisor: [204, 204, 204], // #cccccc
  entradaFundo: [230, 244, 234], // #e6f4ea
  entradaTexto: [27, 74, 59], // #1b4a3b
  saidaFundo: [253, 238, 230], // #fdeee6
  saidaTexto: [200, 103, 86], // #c86756
};

// Mesma ordem e mesma proporção (flex) das colunas da tela.
const COLUNAS = [
  { titulo: "Data", flex: 1.3 },
  { titulo: "Material", flex: 1.8 },
  { titulo: "Tipo", flex: 1 },
  { titulo: "Quantidade", flex: 1.4 },
  { titulo: "Responsável", flex: 1.5 },
];
const COLUNA_TIPO = 2;

const MARGEM = { top: 14, right: 14, bottom: 18, left: 14 };

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
//   tipo           "todas" | "entrada" | "saida" (filtro da tela)
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
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const larguraUtil = larguraPagina - MARGEM.left - MARGEM.right;
  const direita = larguraPagina - MARGEM.right;

  const totalEntradas = movimentacoes.filter((m) => m.tipo === "entrada").length;
  const totalSaidas = movimentacoes.length - totalEntradas;

  const horaFormatada = geradoEm.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.setProperties({
    title: "Relatório de Movimentações",
    author: "Sistema de Estoque",
    creator: "Sistema de Estoque",
  });

  // ----- Cabeçalho da primeira página -----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR.textoSuave);
  doc.text("Sistema de Estoque", MARGEM.left, 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COR.verdeEscuro);
  doc.text("Relatório de Movimentações", MARGEM.left, 24);

  // Resumo alinhado à direita, na altura do título
  const totalTexto = `${movimentacoes.length} ${
    movimentacoes.length === 1 ? "movimentação" : "movimentações"
  }`;
  doc.setFontSize(11);
  doc.setTextColor(...COR.textoPrincipal);
  doc.text(totalTexto, direita, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR.textoSuave);
  doc.text(
    `${totalEntradas} ${totalEntradas === 1 ? "entrada" : "entradas"}, ${totalSaidas} ${
      totalSaidas === 1 ? "saída" : "saídas"
    }`,
    direita,
    25,
    { align: "right" }
  );

  // Divisor (igual à linha cinza abaixo do título nas telas do app)
  doc.setDrawColor(...COR.divisor);
  doc.setLineWidth(0.3);
  doc.line(MARGEM.left, 28, direita, 28);

  // Linhas de informação: rótulo em negrito + valor
  const tipoTexto =
    tipo === "entrada" ? "Entradas" : tipo === "saida" ? "Saídas" : "Todas";

  const infos = [
    ["Período:", descreverPeriodo(inicio, fim)],
    ["Tipo:", tipoTexto],
  ];
  if (busca) infos.push(["Busca:", limitar(busca, 70)]);
  infos.push([
    "Gerado em:",
    `${formatarDataBR(geradoEm)} às ${horaFormatada}`,
  ]);

  let y = 35;
  infos.forEach(([rotulo, valor]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COR.textoSuave);
    doc.text(rotulo, MARGEM.left, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COR.textoPrincipal);
    doc.text(valor, MARGEM.left + 22, y);
    y += 5;
  });

  // ----- Tabela (mesmas colunas da tela) -----
  const somaFlex = COLUNAS.reduce((soma, col) => soma + col.flex, 0);
  const columnStyles = {};
  COLUNAS.forEach((col, index) => {
    columnStyles[index] = { cellWidth: (larguraUtil * col.flex) / somaFlex };
  });
  // Na tela, "Data" e "Responsável" são em cinza mais claro
  columnStyles[0].textColor = COR.textoSuave;
  columnStyles[4].textColor = COR.textoSuave;

  autoTable(doc, {
    startY: y + 3,
    margin: MARGEM,
    theme: "plain",
    // O cabeçalho da tela é em maiúsculas
    head: [COLUNAS.map((col) => col.titulo.toUpperCase())],
    body: movimentacoes.map((item) => [
      item.data ?? "",
      item.materialNome ?? "",
      item.tipo === "entrada" ? "Entrada" : "Saída", // desenhado como selo abaixo
      item.quantidade ?? "",
      item.responsavel ?? "",
    ]),
    columnStyles,
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: COR.textoPrincipal,
      cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
      valign: "middle",
      overflow: "linebreak",
      lineColor: COR.linha,
      lineWidth: { bottom: 0.2 },
    },
    headStyles: {
      fillColor: COR.fundoCabecalho,
      textColor: COR.textoSuave,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    // Uma linha nunca é cortada no meio entre duas páginas
    rowPageBreak: "avoid",
    showHead: "everyPage",

    // A coluna "Tipo" é desenhada como o selo colorido da tela, então o
    // texto simples da célula é escondido aqui e o selo sai no didDrawCell.
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === COLUNA_TIPO) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== COLUNA_TIPO) return;

      const item = movimentacoes[data.row.index];
      const entrada = item?.tipo === "entrada";
      const rotulo = entrada ? "Entrada" : "Saída";

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);

      const alturaSelo = 5.2;
      const larguraSelo = doc.getTextWidth(rotulo) + 5.2;
      const x = data.cell.x + 2.5;
      const yTopo = data.cell.y + (data.cell.height - alturaSelo) / 2;

      doc.setFillColor(...(entrada ? COR.entradaFundo : COR.saidaFundo));
      doc.roundedRect(x, yTopo, larguraSelo, alturaSelo, alturaSelo / 2, alturaSelo / 2, "F");

      doc.setTextColor(...(entrada ? COR.entradaTexto : COR.saidaTexto));
      doc.text(rotulo, x + larguraSelo / 2, yTopo + alturaSelo / 2, {
        align: "center",
        baseline: "middle",
      });
    },
  });

  // ----- Rodapé em todas as páginas ("Página X de Y") -----
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COR.textoSuave);
    doc.text(
      "Sistema de Estoque - Relatório de Movimentações",
      MARGEM.left,
      alturaPagina - 8
    );
    doc.text(`Página ${pagina} de ${totalPaginas}`, direita, alturaPagina - 8, {
      align: "right",
    });
  }

  return { doc, nomeArquivo: montarNomeArquivo(inicio, fim, geradoEm) };
}

// Baixa o PDF no navegador (mesma técnica do relatório de Estoque:
// cria um link temporário e clica nele). Só funciona na versão web.
export function baixarPdf(doc, nomeArquivo) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
