// Datas no fuso de Brasília.
//
// O servidor (ex: Vercel) roda em UTC. Qualquer coisa que dependa do
// "relógio local" (getHours, getDate...) sai 3 horas adiantada e muda de dia
// às 21h de Brasília. Aqui tudo é calculado com o fuso explícito, então o
// resultado é o mesmo em qualquer servidor.
const FUSO = 'America/Sao_Paulo';

// Hoje à meia-noite UTC, mas com o DIA de Brasília (dá pra comparar
// direto com datas guardadas como "só dia", ex: validade).
// `agora` existe só para poder testar.
function hojeBrasil(agora = new Date()) {
  const texto = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora); // "AAAA-MM-DD"

  const [ano, mes, dia] = texto.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23', // meia-noite = 00, nunca 24
});

// Um instante (ex: createdAt) -> "DD/MM/AAAA HH:mm" no horário de Brasília.
function formatDataHoraBR(data) {
  const partes = {};
  for (const parte of formatadorDataHora.formatToParts(new Date(data))) {
    partes[parte.type] = parte.value;
  }
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

module.exports = { FUSO, hojeBrasil, formatDataHoraBR };
