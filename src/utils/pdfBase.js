// utils/pdfBase.js
//
// Peças comuns a todos os PDFs do sistema (relatório de movimentações,
// termo de retirada e termo de empréstimo), pra todos terem a mesma cara:
//   - cabeçalho institucional (Etec / Centro Paula Souza / Governo do Estado)
//   - visual minimalista, SÓ em preto e cinza (pensado pra imprimir)
//   - rodapé "Página X de Y"
//   - campos de assinatura
//   - download do arquivo no navegador
//
// Obs: o PDF só usa caracteres do alfabeto Latin-1 (acentos do português
// funcionam normal). Evite "—", "•" e "…": a fonte padrão (Helvetica) não
// desenha esses símbolos de forma confiável.

import { jsPDF } from "jspdf";
import {
  CABECALHO_PNG_BASE64,
  CABECALHO_LARGURA,
  CABECALHO_ALTURA,
} from "./cabecalhoPdfImagem";
import { formatarDataBR } from "./datas";

// Tudo em tons de cinza, em [R, G, B].
export const COR = {
  preto: [0, 0, 0],
  texto: [33, 33, 33],
  suave: [95, 95, 95],
  linha: [190, 190, 190],
  linhaFraca: [225, 225, 225],
};

export const MARGEM = { top: 10, right: 15, bottom: 18, left: 15 };

export function criarDocumento(titulo) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  doc.setProperties({
    title: titulo,
    author: "Sistema de Estoque",
    creator: "Sistema de Estoque",
  });
  doc.setFont("helvetica", "normal");

  return doc;
}

export function medidas(doc) {
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  return {
    largura,
    altura,
    util: largura - MARGEM.left - MARGEM.right,
    esquerda: MARGEM.left,
    direita: largura - MARGEM.right,
  };
}

// Desenha as três logos no topo da página (igual à Declaração de Matrícula)
// e devolve o "y" onde o conteúdo pode começar.
export function desenharCabecalho(doc) {
  const { util, esquerda } = medidas(doc);
  const altura = (util * CABECALHO_ALTURA) / CABECALHO_LARGURA;

  doc.addImage(
    CABECALHO_PNG_BASE64,
    "PNG",
    esquerda,
    MARGEM.top,
    util,
    altura,
    "cabecalho-institucional",
    "FAST"
  );

  return MARGEM.top + altura + 9;
}

// Título centralizado, como na Declaração de Matrícula. Devolve o novo y.
export function desenharTitulo(doc, titulo, y, subtitulo = "") {
  const { largura } = medidas(doc);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COR.preto);
  doc.text(titulo.toUpperCase(), largura / 2, y, { align: "center" });

  if (subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COR.suave);
    doc.text(subtitulo, largura / 2, y + 6, { align: "center" });
    return y + 14;
  }
  return y + 9;
}

// Linhas "Rótulo: valor" (rótulo em negrito). Devolve o novo y.
export function desenharCampos(doc, campos, y, { colunaRotulo = 38 } = {}) {
  const { esquerda, util } = medidas(doc);

  campos.forEach(([rotulo, valor]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COR.texto);
    doc.text(`${rotulo}:`, esquerda, y);

    doc.setFont("helvetica", "normal");
    const linhas = doc.splitTextToSize(String(valor ?? ""), util - colunaRotulo);
    doc.text(linhas, esquerda + colunaRotulo, y);
    y += 5.5 * linhas.length;
  });

  return y;
}

// Parágrafo de texto corrido. Devolve o novo y.
export function desenharParagrafo(doc, texto, y, { tamanho = 10, espaco = 5 } = {}) {
  const { esquerda, util } = medidas(doc);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(tamanho);
  doc.setTextColor(...COR.texto);

  const linhas = doc.splitTextToSize(texto, util);
  doc.text(linhas, esquerda, y, { lineHeightFactor: 1.5 });

  return y + linhas.length * tamanho * 0.3528 * 1.5 + espaco;
}

// Garante `necessario` mm livres na página; se não couber, abre uma página
// nova. Usado antes do texto + assinaturas, pra não ficarem separados.
// Devolve o y onde o conteúdo deve continuar.
export function garantirEspaco(doc, y, necessario) {
  const { altura } = medidas(doc);
  if (y + necessario > altura - MARGEM.bottom) {
    doc.addPage();
    return MARGEM.top + 10;
  }
  return y;
}

// Estilos de tabela minimalista (sem cores): cabeçalho em negrito com uma
// linha preta embaixo e linhas finas cinza entre os itens.
export function estiloTabela() {
  return {
    theme: "plain",
    margin: MARGEM,
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      textColor: COR.texto,
      cellPadding: { top: 2.8, right: 2.5, bottom: 2.8, left: 2.5 },
      valign: "middle",
      overflow: "linebreak",
      lineColor: COR.linha,
      lineWidth: { bottom: 0.2 },
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 9,
      textColor: COR.preto,
      lineColor: COR.preto,
      lineWidth: { bottom: 0.5 },
    },
    // Uma linha nunca é cortada no meio entre duas páginas
    rowPageBreak: "avoid",
    showHead: "everyPage",
  };
}

// Campos de assinatura lado a lado. Cada item:
//   { rotulo: "Retirante", nome: "Fulano" (opcional, já impresso embaixo da
//     linha), detalhe: "RM 123" (opcional) }
// Se não couber na página, vai para uma nova. Devolve o novo y.
export function desenharAssinaturas(doc, y, assinaturas) {
  const { altura, util, esquerda } = medidas(doc);
  const alturaBloco = 44;

  if (y + alturaBloco > altura - MARGEM.bottom) {
    doc.addPage();
    y = MARGEM.top + 10;
  }

  const folga = 12;
  const n = assinaturas.length;
  const larguraCol = (util - folga * (n - 1)) / n;
  const yLinha = y + 20;
  const passo = 4.6;

  // Descobre quantas linhas de texto a maior assinatura ocupa, pra deixar
  // todos os campos "Data:" alinhados na mesma altura.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const linhasNome = assinaturas.map((a) =>
    a.nome ? doc.splitTextToSize(a.nome, larguraCol) : []
  );
  const maxLinhas = Math.max(
    ...assinaturas.map(
      (a, i) => linhasNome[i].length + 1 + (a.detalhe ? 1 : 0)
    )
  );
  const yData = yLinha + 5 + passo * maxLinhas + 2;

  assinaturas.forEach((assinatura, i) => {
    const x = esquerda + i * (larguraCol + folga);
    const centro = x + larguraCol / 2;

    doc.setDrawColor(...COR.preto);
    doc.setLineWidth(0.3);
    doc.line(x, yLinha, x + larguraCol, yLinha);

    let yTexto = yLinha + 5;

    if (linhasNome[i].length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...COR.preto);
      doc.text(linhasNome[i], centro, yTexto, { align: "center" });
      yTexto += passo * linhasNome[i].length;
    }

    doc.setFont("helvetica", assinatura.nome ? "normal" : "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...(assinatura.nome ? COR.suave : COR.preto));
    doc.text(assinatura.rotulo, centro, yTexto, { align: "center" });
    yTexto += passo;

    if (assinatura.detalhe) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COR.suave);
      doc.text(assinatura.detalhe, centro, yTexto, { align: "center" });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COR.suave);
    doc.text("Data: ____/____/________", centro, yData, { align: "center" });
  });

  return yData + 6;
}

// Rodapé em todas as páginas: texto à esquerda e "Página X de Y" à direita.
export function desenharRodape(doc, textoEsquerda, geradoEm = new Date()) {
  const { altura, esquerda, direita } = medidas(doc);
  const total = doc.getNumberOfPages();
  const hora = geradoEm.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);

    doc.setDrawColor(...COR.linha);
    doc.setLineWidth(0.2);
    doc.line(esquerda, altura - 13, direita, altura - 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COR.suave);
    doc.text(
      `${textoEsquerda} - gerado em ${formatarDataBR(geradoEm)} às ${hora}`,
      esquerda,
      altura - 8
    );
    doc.text(`Página ${pagina} de ${total}`, direita, altura - 8, { align: "right" });
  }
}

// "06-10-2026_1117" — pra nomes de arquivo que não se repetem.
export function carimboArquivo(data) {
  const dia = formatarDataBR(data).split("/").join("-");
  const hora = String(data.getHours()).padStart(2, "0");
  const min = String(data.getMinutes()).padStart(2, "0");
  return `${dia}_${hora}${min}`;
}

// Baixa o PDF no navegador (cria um link temporário e clica nele). Só
// funciona na versão web.
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
