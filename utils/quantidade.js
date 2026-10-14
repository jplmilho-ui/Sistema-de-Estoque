// Quantidades: unidades x embalagens (caixa, pacote...).
//
// O estoque é guardado em UNIDADES (material.quantidadeTotal). A "embalagem"
// é só uma forma de digitar e de exibir. Este arquivo espelha o cálculo do
// backend (estoque-backend/src/lib/quantidade.js) para as telas poderem
// mostrar prévia e validar antes de enviar — quem decide, no fim, é o servidor.

// Rótulos das duas formas de pedir, usados nos botões de escolha:
//   "Por caixa" | "Por unidade"  (ou "Por pacote", conforme o material)
export const ROTULO_POR_UNIDADE = "Por unidade";
export function rotuloPorEmbalagem(material) {
  return `Por ${String(material?.unidadeMedida || "embalagem").toLowerCase()}`;
}

// O material vem em embalagem de verdade? ("Unidade" ou fator 1 = não vem)
export function temEmbalagem(material) {
  return (
    !!material &&
    !!material.unidadeMedida &&
    material.unidadeMedida !== "Unidade" &&
    Number(material.fatorConversao) > 1
  );
}

// 162 un. de caixas de 50 -> { embalagens: 3, avulsas: 12 }
export function dividirEmbalagens(unidades, fatorConversao) {
  const fator = Number(fatorConversao);
  if (!(fator > 1)) return { embalagens: unidades, avulsas: 0 };
  return { embalagens: Math.floor(unidades / fator), avulsas: unidades % fator };
}

// Converte o que a pessoa digitou ("embalagem" ou "unidade") para UNIDADES.
export function paraUnidades(quantidade, entrada, material) {
  if (entrada === "unidade") return quantidade;
  return quantidade * (Number(material?.fatorConversao) || 1);
}

// "5 un." / "2 caixas (100 un.)" / "3 caixas e 12 un. (162 un.)"
// Mesmo texto que o backend devolve em quantidadeTexto.
export function textoQuantidade(unidades, material) {
  if (!temEmbalagem(material)) return `${unidades} un.`;

  const { embalagens, avulsas } = dividirEmbalagens(unidades, material.fatorConversao);
  if (embalagens === 0) return `${unidades} un.`;

  const nome = material.unidadeMedida.toLowerCase();
  const rotulo = embalagens === 1 ? nome : `${nome}s`;

  if (avulsas === 0) return `${embalagens} ${rotulo} (${unidades} un.)`;
  return `${embalagens} ${rotulo} e ${avulsas} un. (${unidades} un.)`;
}
