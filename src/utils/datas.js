// utils/datas.js
//
// Funções de data usadas pelas telas e pelos PDFs (formato brasileiro
// DD/MM/AAAA). Ficam aqui para Movimentações, Estoque e Empréstimos usarem
// exatamente a mesma regra.

const MS_DIA = 24 * 60 * 60 * 1000;

// Devolve "DD/MM/AAAA" a partir de um Date.
export function formatarDataBR(data) {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

// Devolve "DD/MM/AAAA HH:mm" a partir de um Date ou de uma data ISO.
export function formatarDataHoraBR(valor) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  const hora = String(data.getHours()).padStart(2, "0");
  const min = String(data.getMinutes()).padStart(2, "0");
  return `${formatarDataBR(data)} ${hora}:${min}`;
}

// Máscara pro campo de data: a pessoa digita só os números e a barra é
// colocada sozinha. "10092026" -> "10/09/2026".
export function mascararData(texto) {
  const numeros = String(texto ?? "").replace(/\D/g, "").slice(0, 8);

  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 4) return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
}

// Lê "DD/MM/AAAA" com validação de calendário de verdade (31/02/2026 é
// rejeitado). Devolve um Date à meia-noite local, ou null se inválida.
export function lerDataBR(texto) {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto ?? "").trim());
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

  return existe ? data : null;
}

// Hoje, à meia-noite (horário local do aparelho).
export function hoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Quantos dias faltam de hoje até a data (0 = hoje, negativo = já passou).
export function diasAte(data) {
  const alvo = new Date(data);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje()) / MS_DIA);
}

// Texto curto do prazo: "vence hoje", "vence amanhã", "vence em 3 dias",
// "atrasado há 2 dias".
export function textoPrazo(dias) {
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias > 1) return `vence em ${dias} dias`;
  const atraso = Math.abs(dias);
  return `atrasado há ${atraso} ${atraso === 1 ? "dia" : "dias"}`;
}
