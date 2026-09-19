// utils/validade.js
//
// Funções auxiliares pra trabalhar com a validade dos materiais (que é
// salva como texto "DD/MM/AAAA"). Compartilhado entre Estoque e Tela
// Inicial pra não duplicar a mesma regra em dois lugares.

// Converte "DD/MM/AAAA" pra um Date de verdade.
export function parseDataBR(dataStr) {
  if (!dataStr) return null;
  const partes = dataStr.split("/");
  if (partes.length !== 3) return null;
  const [dia, mes, ano] = partes.map(Number);
  if (!dia || !mes || !ano) return null;
  const data = new Date(ano, mes - 1, dia);
  return Number.isNaN(data.getTime()) ? null : data;
}

// Um material está vencido quando a validade dele já passou (compara só
// a data, ignorando a hora). Sem validade cadastrada, nunca é vencido.
export function isVencido(validade) {
  const data = parseDataBR(validade);
  if (!data) return false;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);

  return data < hoje;
}