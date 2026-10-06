// Regras de estoque usadas pelas telas.

// Estoque baixo: o material tem um estoque mínimo configurado (na tela de
// Materiais) e a quantidade atual chegou nele ou ficou abaixo.
// Mínimo 0 (ou vazio) significa "sem alerta" — não é uma decisão visual,
// vem sempre do valor cadastrado pelo admin/coordenador.
// "quantidade" e "estoqueMinimo" estão na mesma unidade (ex: caixas).
export function isEstoqueBaixo(material) {
  const minimo = Number(material?.estoqueMinimo) || 0;
  return minimo > 0 && material.quantidade <= minimo;
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
