const prisma = require('../lib/prisma');
const { formatDataHoraBR } = require('./material.controller');

// Monta o texto de quantidade do jeito que a tela mostra, ex:
// "2 caixas (100 un.)" ou "5 un." — usando a unidade do material
// associado a essa movimentação específica.
function formatQuantidade(movimentacao) {
  const { unidadeMedida, fatorConversao } = movimentacao.material;
  const qtd = movimentacao.quantidade;

  if (unidadeMedida === 'Unidade') {
    return `${qtd} un.`;
  }

  const unidadeLower = unidadeMedida.toLowerCase();
  const plural = qtd === 1 ? unidadeLower : `${unidadeLower}s`;
  const total = qtd * fatorConversao;

  return `${qtd} ${plural} (${total} un.)`;
}

async function listMovimentacoes(req, res) {
  try {
    const movimentacoes = await prisma.movimentacao.findMany({
      include: { material: true, responsavel: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      movimentacoes: movimentacoes.map((mov) => ({
        id: mov.id,
        materialNome: mov.material.nome,
        tipo: mov.tipo,
        quantidade: formatQuantidade(mov),
        data: formatDataHoraBR(mov.createdAt),
        responsavel: mov.responsavel.name,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar movimentações.' });
  }
}

module.exports = { listMovimentacoes };
