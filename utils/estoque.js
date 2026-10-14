// Regras de estoque usadas pelas telas.

// Estoque baixo: o material tem um estoque mínimo configurado (na tela de
// Materiais) e a quantidade atual chegou nele ou ficou abaixo.
// Mínimo 0 (ou vazio) significa "sem alerta" — não é uma decisão visual,
// vem sempre do valor cadastrado pelo admin/coordenador.
// O estoque mínimo é em EMBALAGENS (ex: 3 caixas); o saldo é em unidades.
// Compara tudo em unidades: quantidadeTotal <= mínimo x unidades por embalagem.
export function isEstoqueBaixo(material) {
  const minimo = Number(material?.estoqueMinimo) || 0;
  const fator = Number(material?.fatorConversao) || 1;
  return minimo > 0 && material.quantidadeTotal <= minimo * fator;
}

// Texto do aviso, ex: "Estoque baixo (mínimo: 3 caixa(s))".
export function textoEstoqueBaixo(material) {
  const minimo = Number(material.estoqueMinimo) || 0;
  const unidade =
    material.unidadeMedida === "Unidade"
      ? "un."
      : `${material.unidadeMedida.toLowerCase()}(s)`;
  return `Estoque baixo (mínimo: ${minimo} ${unidade})`;
}
