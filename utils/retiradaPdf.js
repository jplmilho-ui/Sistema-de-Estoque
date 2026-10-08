// utils/retiradaPdf.js
//
// TERMO DE RETIRADA DE MATERIAIS — PDF pra imprimir e assinar.
//
// Lista os itens que foram retirados do estoque e traz dois campos de
// assinatura:
//   - quem retirou (o NOME já sai preenchido, vindo da conta logada)
//   - a coordenação
//
// Mesmo visual minimalista e sem cores dos outros PDFs (utils/pdfBase.js).

import autoTable from "jspdf-autotable";
import {
  criarDocumento,
  desenharCabecalho,
  desenharTitulo,
  desenharCampos,
  desenharParagrafo,
  desenharAssinaturas,
  desenharRodape,
  estiloTabela,
  carimboArquivo,
  garantirEspaco,
} from "./pdfBase";
import { formatarDataBR, formatarDataHoraBR } from "./datas";

const PAPEL_LABEL = {
  admin: "Administrador(a)",
  coordenador: "Coordenador(a)",
  professor: "Professor(a)",
  aluno: "Aluno(a)",
};

// "2 caixas (100 un.)" / "5 un." — mesmo texto da coluna Quantidade do Estoque.
export function textoQuantidade(quantidade, material) {
  const { unidadeMedida, fatorConversao } = material;

  if (!unidadeMedida || unidadeMedida === "Unidade") {
    return `${quantidade} un.`;
  }

  const unidadeLower = unidadeMedida.toLowerCase();
  const plural = quantidade === 1 ? unidadeLower : `${unidadeLower}s`;
  return `${quantidade} ${plural} (${quantidade * (fatorConversao || 1)} un.)`;
}

// Monta o PDF e devolve { doc, nomeArquivo }.
//
//   itens      [{ nome, categoria, ca, quantidadeTexto, quando (Date) }]
//   retirante  { nome, role, rm? } — dados da conta de quem retirou
//   geradoEm   Date (padrão: agora)
export function gerarPdfRetirada({ itens, retirante, geradoEm = new Date() }) {
  const doc = criarDocumento("Termo de Retirada de Materiais");

  let y = desenharCabecalho(doc);
  y = desenharTitulo(doc, "Termo de Retirada de Materiais", y + 4);

  const campos = [
    ["Retirante", retirante?.nome || ""],
    ["Função", PAPEL_LABEL[retirante?.role] || ""],
  ];
  if (retirante?.rm) campos.push(["RM", retirante.rm]);
  campos.push(["Data", formatarDataBR(geradoEm)]);

  y = desenharCampos(doc, campos, y + 2, { colunaRotulo: 24 });

  autoTable(doc, {
    ...estiloTabela(),
    startY: y + 4,
    head: [["Nº", "Material", "Categoria", "C.A.", "Quantidade", "Data e hora"]],
    body: itens.map((item, index) => [
      String(index + 1),
      item.nome ?? "",
      item.categoria ?? "",
      item.ca || "-",
      item.quantidadeTexto ?? "",
      item.quando ? formatarDataHoraBR(item.quando) : "",
    ]),
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 52 },
      2: { cellWidth: 24 },
      3: { cellWidth: 16 },
      4: { cellWidth: 40 },
    },
  });

  y = garantirEspaco(doc, doc.lastAutoTable.finalY + 10, 70);

  y = desenharParagrafo(
    doc,
    `Declaro que retirei do estoque ${
      itens.length === 1 ? "o material listado" : "os materiais listados"
    } acima, responsabilizando-me pelo seu uso adequado.`,
    y
  );

  desenharAssinaturas(doc, y + 6, [
    {
      rotulo: "Retirante",
      nome: retirante?.nome || "",
      detalhe: retirante?.rm ? `RM ${retirante.rm}` : "",
    },
    { rotulo: "Coordenação" },
  ]);

  desenharRodape(doc, "Sistema de Estoque - Termo de Retirada", geradoEm);

  return { doc, nomeArquivo: `termo-retirada_${carimboArquivo(geradoEm)}.pdf` };
}
