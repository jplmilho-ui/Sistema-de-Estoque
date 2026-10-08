// utils/emprestimoPdf.js
//
// TERMO DE EMPRÉSTIMO DE UNIFORME — PDF pra imprimir e assinar.
//
// Traz o aluno (nome e RM já preenchidos), o uniforme, a quantidade e a
// DATA DE DEVOLUÇÃO, e dois campos de assinatura: aluno e coordenação.
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
import { formatarDataHoraBR } from "./datas";

// Monta o PDF e devolve { doc, nomeArquivo }.
//
//   emprestimo  o objeto devolvido pela API (ver serializeEmprestimo no
//               backend): { id, alunoNome, alunoRm, materialNome, categoria,
//               quantidadeTexto, dataDevolucao ("DD/MM/AAAA"), criadoEm (ISO),
//               observacao }
//   geradoEm    Date (padrão: agora)
export function gerarPdfEmprestimo({ emprestimo, geradoEm = new Date() }) {
  const doc = criarDocumento("Termo de Empréstimo de Uniforme");

  let y = desenharCabecalho(doc);
  y = desenharTitulo(
    doc,
    "Termo de Empréstimo de Uniforme",
    y + 4,
    `Empréstimo nº ${String(emprestimo.id).padStart(4, "0")}`
  );

  const campos = [
    ["Aluno(a)", emprestimo.alunoNome || ""],
    ["RM", emprestimo.alunoRm || "-"],
    // O empréstimo só vale a partir da confirmação da equipe.
    ["Data do empréstimo", formatarDataHoraBR(emprestimo.respondidoEm || emprestimo.criadoEm)],
    ["Devolução até", emprestimo.dataDevolucao || ""],
  ];
  if (emprestimo.observacao) campos.push(["Observação", emprestimo.observacao]);

  y = desenharCampos(doc, campos, y + 2, { colunaRotulo: 40 });

  autoTable(doc, {
    ...estiloTabela(),
    startY: y + 4,
    head: [["Material", "Categoria", "Quantidade", "Devolução até"]],
    body: [
      [
        emprestimo.materialNome ?? "",
        emprestimo.categoria ?? "",
        emprestimo.quantidadeTexto ?? "",
        emprestimo.dataDevolucao ?? "",
      ],
    ],
  });

  y = garantirEspaco(doc, doc.lastAutoTable.finalY + 10, 70);

  y = desenharParagrafo(
    doc,
    `Declaro que recebi o uniforme acima em regime de empréstimo e me comprometo a devolvê-lo limpo e em bom estado até ${
      emprestimo.dataDevolucao || "a data combinada"
    }.`,
    y
  );
  y = desenharParagrafo(
    doc,
    "Em caso de perda, dano ou impossibilidade de devolver no prazo, devo avisar a coordenação o quanto antes.",
    y
  );

  desenharAssinaturas(doc, y + 6, [
    {
      rotulo: "Aluno(a)",
      nome: emprestimo.alunoNome || "",
      detalhe: emprestimo.alunoRm ? `RM ${emprestimo.alunoRm}` : "",
    },
    { rotulo: "Coordenação" },
  ]);

  desenharRodape(doc, "Sistema de Estoque - Termo de Empréstimo", geradoEm);

  return {
    doc,
    nomeArquivo: `termo-emprestimo-${String(emprestimo.id).padStart(4, "0")}_${carimboArquivo(geradoEm)}.pdf`,
  };
}
