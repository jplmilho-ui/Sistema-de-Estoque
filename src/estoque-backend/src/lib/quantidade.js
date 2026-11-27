// ---------------------------------------------------------------
// QUANTIDADES: unidades x embalagens
//
// O estoque é guardado SEMPRE em unidades (Material.quantidadeTotal).
// A "embalagem" (caixa, pacote...) é só uma forma de digitar e de exibir:
//   - fatorConversao = quantas unidades cabem em 1 embalagem (ex: 50)
//   - 162 unidades de uma caixa de 50 = 3 caixas fechadas + 12 avulsas
//
// Movimentacao, Solicitacao e Emprestimo também guardam a quantidade em
// UNIDADES. Assim retirar 1 unidade de um item "em caixa" é possível, e o
// histórico não muda se alguém corrigir o fator de conversão depois.
//
// Nas requisições, o app diz em que unidade a pessoa digitou:
//   { quantidade: 2, unidade: "embalagem" }  -> 2 caixas  (padrão)
//   { quantidade: 2, unidade: "unidade" }    -> 2 unidades (sem levar a caixa toda)
// ---------------------------------------------------------------
const { ErroNegocio } = require('./erros');

// Maior número que cabe num campo Int do banco (4 bytes).
const INT_MAXIMO = 2147483647;

const ENTRADAS = ['embalagem', 'unidade'];

// Aceita só número inteiro maior que zero. Recusa decimal ("2.5"),
// notação científica ("1e3"), texto, vazio e negativo.
function lerQuantidadePositiva(valor, maximo, contexto = 'operação') {
  const texto = String(valor ?? '').trim();

  if (!/^\d+$/.test(texto) || Number(texto) <= 0) {
    throw new ErroNegocio(
      400,
      'Informe uma quantidade válida: um número inteiro maior que zero.'
    );
  }

  const quantidade = Number(texto);
  if (quantidade > maximo) {
    throw new ErroNegocio(400, `A quantidade máxima por ${contexto} é ${maximo}.`);
  }

  return quantidade;
}

// "embalagem" (padrão, igual ao comportamento antigo da API) ou "unidade".
function lerEntrada(valor) {
  if (valor === undefined || valor === null || valor === '') return 'embalagem';

  const entrada = String(valor).trim().toLowerCase();
  if (!ENTRADAS.includes(entrada)) {
    throw new ErroNegocio(400, 'Unidade da quantidade inválida. Use "embalagem" ou "unidade".');
  }
  return entrada;
}

// O material tem embalagem de verdade? ("Unidade" ou fator 1 = não tem)
function temEmbalagem(material) {
  return material.unidadeMedida !== 'Unidade' && material.fatorConversao > 1;
}

// Converte o que a pessoa digitou para UNIDADES e confere o teto.
function paraUnidades(quantidade, entrada, material, maximoUnidades, contexto = 'operação') {
  const total = entrada === 'unidade' ? quantidade : quantidade * material.fatorConversao;

  if (total > maximoUnidades) {
    throw new ErroNegocio(
      400,
      `A quantidade máxima por ${contexto} é ${maximoUnidades} unidades.`
    );
  }
  return total;
}

// Aluno só pode pedir por unidade se o material permitir (ex: material
// estéril ou kit fechado não deve ser aberto). Equipe não passa por aqui.
function exigirFracionamento(entrada, material) {
  if (entrada === 'unidade' && temEmbalagem(material) && !material.permiteFracionar) {
    throw new ErroNegocio(
      400,
      `Esse material só pode ser pedido por ${material.unidadeMedida.toLowerCase()} ` +
        `(${material.fatorConversao} un.), não por unidade.`
    );
  }
}

// 162 un. de caixas de 50 -> { embalagens: 3, avulsas: 12 }
function dividirEmbalagens(unidades, fatorConversao) {
  if (!(fatorConversao > 1)) return { embalagens: unidades, avulsas: 0 };
  return {
    embalagens: Math.floor(unidades / fatorConversao),
    avulsas: unidades % fatorConversao,
  };
}

// Texto pronto pra tela:
//   "5 un."                          (material em unidade, ou menos de 1 embalagem)
//   "2 caixas (100 un.)"             (embalagens fechadas)
//   "3 caixas e 12 un. (162 un.)"    (embalagens + avulsas)
function formatQuantidade(unidades, material) {
  const { unidadeMedida, fatorConversao } = material;

  if (!temEmbalagem(material)) return `${unidades} un.`;

  const { embalagens, avulsas } = dividirEmbalagens(unidades, fatorConversao);
  if (embalagens === 0) return `${unidades} un.`;

  const nome = unidadeMedida.toLowerCase();
  const rotulo = embalagens === 1 ? nome : `${nome}s`;

  if (avulsas === 0) return `${embalagens} ${rotulo} (${unidades} un.)`;
  return `${embalagens} ${rotulo} e ${avulsas} un. (${unidades} un.)`;
}

// Campos derivados que a API devolve junto com o material:
//   quantidade      -> embalagens FECHADAS (compatível com o que o app já lia)
//   unidadesAvulsas -> sobra que não completa uma embalagem
//   quantidadeTexto -> pronto pra exibir
// (quantidadeTotal, em unidades, já vem do próprio banco.)
function descreverEstoque(material) {
  const { embalagens, avulsas } = dividirEmbalagens(
    material.quantidadeTotal,
    material.fatorConversao
  );
  return {
    quantidade: embalagens,
    unidadesAvulsas: avulsas,
    quantidadeTexto: formatQuantidade(material.quantidadeTotal, material),
  };
}

module.exports = {
  INT_MAXIMO,
  lerQuantidadePositiva,
  lerEntrada,
  temEmbalagem,
  paraUnidades,
  exigirFracionamento,
  dividirEmbalagens,
  formatQuantidade,
  descreverEstoque,
};
