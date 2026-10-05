const prisma = require('../lib/prisma');

// ---------------------------------------------------------------
// SOLICITAÇÕES DE MATERIAL (aluno -> professor/coordenador/admin)
//
// Permissões (ver solicitacao.routes.js):
//   aluno                          -> criar, ver as suas, cancelar pendente
//   admin, coordenador, professor  -> ver pendentes, aprovar, recusar
//
// Regras importantes:
//   - Quem responder primeiro encerra o pedido (aprovar/recusar só
//     funciona enquanto o status for "pendente").
//   - Aprovar BAIXA o estoque e registra uma Movimentacao de saída em
//     nome de quem aprovou — tudo numa transação: ou faz tudo, ou nada.
//   - Quem aprova não precisa da permissão de ninguém para retirar:
//     a retirada direta pela tela de Estoque continua como sempre foi.
// ---------------------------------------------------------------

const CATEGORIAS_SOLICITAVEIS = ['EPI', 'Uniforme'];
const QUANTIDADE_MAXIMA = 9999;
const TEXTO_MAXIMO = 300;
const DIAS_RESPOSTAS_RECENTES = 7;
const MAX_RESPOSTAS_RECENTES = 10;

// Erro "esperado" (regra de negócio) com o status HTTP que deve voltar.
class ErroNegocio extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function responderErro(res, error, mensagemPadrao) {
  if (error instanceof ErroNegocio) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: mensagemPadrao });
}

// "2 caixas (100 un.)" / "5 un." — mesmo formato da tela de Movimentações.
function formatQuantidade(quantidade, material) {
  const { unidadeMedida, fatorConversao } = material;

  if (unidadeMedida === 'Unidade') {
    return `${quantidade} un.`;
  }

  const unidadeLower = unidadeMedida.toLowerCase();
  const plural = quantidade === 1 ? unidadeLower : `${unidadeLower}s`;

  return `${quantidade} ${plural} (${quantidade * fatorConversao} un.)`;
}

function parseId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErroNegocio(400, 'Id inválido.');
  }
  return id;
}

function textoOpcional(valor, rotulo) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  if (texto.length > TEXTO_MAXIMO) {
    throw new ErroNegocio(400, `${rotulo} pode ter no máximo ${TEXTO_MAXIMO} caracteres.`);
  }
  return texto;
}

const INCLUDE_COMPLETO = {
  aluno: { select: { name: true, rm: true } },
  material: true,
  respondidoPor: { select: { name: true } },
};

// Formato que o app recebe. `criadoEm`/`respondidoEm` vão em ISO para o
// app calcular "há 5 min"; `quantidadeTexto` já vem pronta pra exibir.
function serializeSolicitacao(s) {
  return {
    id: s.id,
    status: s.status,
    quantidade: s.quantidade,
    quantidadeTexto: formatQuantidade(s.quantidade, s.material),
    observacao: s.observacao,
    motivoRecusa: s.motivoRecusa,
    materialNome: s.material.nome,
    categoria: s.material.categoria,
    unidadeMedida: s.material.unidadeMedida,
    alunoNome: s.aluno.name,
    alunoRm: s.aluno.rm,
    respondidoPorNome: s.respondidoPor ? s.respondidoPor.name : null,
    criadoEm: s.createdAt.toISOString(),
    respondidoEm: s.respondidoEm ? s.respondidoEm.toISOString() : null,
  };
}

// ---------------------------------------------------------------
// ALUNO
// ---------------------------------------------------------------

// Materiais que o aluno pode escolher no formulário.
async function listMateriaisDisponiveis(req, res) {
  try {
    const materiais = await prisma.material.findMany({
      where: {
        ativo: true,
        quantidade: { gt: 0 },
        categoria: { in: CATEGORIAS_SOLICITAVEIS },
      },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        categoria: true,
        unidadeMedida: true,
        fatorConversao: true,
      },
    });

    return res.json({ materiais });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar materiais.');
  }
}

async function criarSolicitacao(req, res) {
  try {
    const materialId = parseId(req.body.materialId);
    const quantidade = Number(req.body.quantidade);
    const observacao = textoOpcional(req.body.observacao, 'A observação');

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new ErroNegocio(400, 'Informe uma quantidade válida, maior que zero.');
    }
    if (quantidade > QUANTIDADE_MAXIMA) {
      throw new ErroNegocio(400, `A quantidade máxima por pedido é ${QUANTIDADE_MAXIMA}.`);
    }

    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material || !material.ativo || !CATEGORIAS_SOLICITAVEIS.includes(material.categoria)) {
      throw new ErroNegocio(404, 'Material não encontrado ou indisponível para solicitação.');
    }
    if (material.quantidade <= 0) {
      throw new ErroNegocio(400, 'Esse material está sem estoque no momento.');
    }
    if (quantidade > material.quantidade) {
      throw new ErroNegocio(
        400,
        `Quantidade indisponível. Disponível: ${material.quantidade} ${material.unidadeMedida.toLowerCase()}(s).`
      );
    }

    const criada = await prisma.solicitacao.create({
      data: { alunoId: req.userId, materialId, quantidade, observacao },
      include: INCLUDE_COMPLETO,
    });

    return res.status(201).json({ solicitacao: serializeSolicitacao(criada) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao criar solicitação.');
  }
}

async function listMinhasSolicitacoes(req, res) {
  try {
    const solicitacoes = await prisma.solicitacao.findMany({
      where: { alunoId: req.userId },
      include: INCLUDE_COMPLETO,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ solicitacoes: solicitacoes.map(serializeSolicitacao) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar suas solicitações.');
  }
}

async function cancelarSolicitacao(req, res) {
  try {
    const id = parseId(req.params.id);

    // Só cancela o PRÓPRIO pedido e só enquanto estiver pendente.
    // updateMany com essa condição evita corrida com uma aprovação.
    const resultado = await prisma.solicitacao.updateMany({
      where: { id, alunoId: req.userId, status: 'pendente' },
      data: { status: 'cancelada' },
    });

    if (resultado.count === 0) {
      const existe = await prisma.solicitacao.findFirst({
        where: { id, alunoId: req.userId },
      });
      if (!existe) throw new ErroNegocio(404, 'Solicitação não encontrada.');
      throw new ErroNegocio(409, 'Essa solicitação já foi respondida e não pode mais ser cancelada.');
    }

    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id },
      include: INCLUDE_COMPLETO,
    });

    return res.json({ solicitacao: serializeSolicitacao(solicitacao) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao cancelar solicitação.');
  }
}

// ---------------------------------------------------------------
// ADMIN / COORDENADOR / PROFESSOR
// ---------------------------------------------------------------

// Pendentes de todos os alunos (mais antigas primeiro) + as últimas
// respostas (pra quem não respondeu ver "Aprovada por Fulano").
async function listSolicitacoes(req, res) {
  try {
    const desde = new Date(Date.now() - DIAS_RESPOSTAS_RECENTES * 24 * 60 * 60 * 1000);

    const [pendentes, respondidas] = await Promise.all([
      prisma.solicitacao.findMany({
        where: { status: 'pendente' },
        include: INCLUDE_COMPLETO,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.solicitacao.findMany({
        where: {
          status: { in: ['aprovada', 'recusada'] },
          respondidoEm: { gte: desde },
        },
        include: INCLUDE_COMPLETO,
        orderBy: { respondidoEm: 'desc' },
        take: MAX_RESPOSTAS_RECENTES,
      }),
    ]);

    return res.json({
      solicitacoes: [...pendentes, ...respondidas].map(serializeSolicitacao),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar solicitações.');
  }
}

async function aprovarSolicitacao(req, res) {
  try {
    const id = parseId(req.params.id);

    await prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacao.findUnique({
        where: { id },
        include: { material: true },
      });

      if (!solicitacao) throw new ErroNegocio(404, 'Solicitação não encontrada.');
      if (solicitacao.status !== 'pendente') {
        throw new ErroNegocio(409, 'Essa solicitação já foi respondida.');
      }
      if (!solicitacao.material.ativo) {
        throw new ErroNegocio(400, 'Esse material está inativo.');
      }

      // 1) "Reserva" a resposta: só passa quem encontrar o pedido ainda
      //    pendente. Se duas pessoas aprovarem juntas, só uma vence.
      const marcada = await tx.solicitacao.updateMany({
        where: { id, status: 'pendente' },
        data: { status: 'aprovada', respondidoPorId: req.userId, respondidoEm: new Date() },
      });
      if (marcada.count === 0) {
        throw new ErroNegocio(409, 'Essa solicitação já foi respondida.');
      }

      // 2) Baixa o estoque só se ainda houver quantidade suficiente.
      //    quantidadeTotal = quantidade * fatorConversao, então baixa
      //    os dois na mesma proporção.
      const { quantidade, material } = solicitacao;
      const baixa = await tx.material.updateMany({
        where: { id: material.id, ativo: true, quantidade: { gte: quantidade } },
        data: {
          quantidade: { decrement: quantidade },
          quantidadeTotal: { decrement: quantidade * material.fatorConversao },
        },
      });
      if (baixa.count === 0) {
        const atual = await tx.material.findUnique({ where: { id: material.id } });
        // Lançar o erro desfaz a "reserva" do passo 1 (rollback).
        throw new ErroNegocio(
          400,
          `Estoque insuficiente. Disponível: ${atual ? atual.quantidade : 0} ${material.unidadeMedida.toLowerCase()}(s).`
        );
      }

      // 3) Registra a saída em Movimentações, em nome de quem aprovou.
      await tx.movimentacao.create({
        data: { tipo: 'saida', quantidade, materialId: material.id, responsavelId: req.userId },
      });
    });

    const aprovada = await prisma.solicitacao.findUnique({
      where: { id },
      include: INCLUDE_COMPLETO,
    });

    return res.json({ solicitacao: serializeSolicitacao(aprovada) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao aprovar solicitação.');
  }
}

async function recusarSolicitacao(req, res) {
  try {
    const id = parseId(req.params.id);
    const motivo = textoOpcional(req.body.motivo, 'O motivo');

    const resultado = await prisma.solicitacao.updateMany({
      where: { id, status: 'pendente' },
      data: {
        status: 'recusada',
        motivoRecusa: motivo,
        respondidoPorId: req.userId,
        respondidoEm: new Date(),
      },
    });

    if (resultado.count === 0) {
      const existe = await prisma.solicitacao.findUnique({ where: { id } });
      if (!existe) throw new ErroNegocio(404, 'Solicitação não encontrada.');
      throw new ErroNegocio(409, 'Essa solicitação já foi respondida.');
    }

    const recusada = await prisma.solicitacao.findUnique({
      where: { id },
      include: INCLUDE_COMPLETO,
    });

    return res.json({ solicitacao: serializeSolicitacao(recusada) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao recusar solicitação.');
  }
}

module.exports = {
  listMateriaisDisponiveis,
  criarSolicitacao,
  listMinhasSolicitacoes,
  cancelarSolicitacao,
  listSolicitacoes,
  aprovarSolicitacao,
  recusarSolicitacao,
};
