const prisma = require('../lib/prisma');
const { formatDataHoraBR } = require('../lib/datas');
const { formatQuantidade } = require('../lib/quantidade');

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
        quantidade: formatQuantidade(mov.quantidade, mov.material),
        quantidadeUnidades: mov.quantidade,
        // Texto no horário de Brasília (para exibir) e o instante exato em ISO
        // (para calcular "há 5 min" certo em qualquer fuso do aparelho).
        data: formatDataHoraBR(mov.createdAt),
        dataISO: mov.createdAt.toISOString(),
        responsavel: mov.responsavel.name,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar movimentações.' });
  }
}

module.exports = { listMovimentacoes };
