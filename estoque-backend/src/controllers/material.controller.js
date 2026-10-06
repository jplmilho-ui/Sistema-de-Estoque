const prisma = require('../lib/prisma');

// ---------------------------------------------------------------
// Datas: o front-end trabalha com validade no formato "dd/mm/aaaa"
// (texto), mas no banco guardamos um DateTime de verdade. Essas duas
// funções fazem a conversão nos dois sentidos.
// ---------------------------------------------------------------

function parseDataBR(texto) {
  if (!texto || !texto.trim()) return null;

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!match) return null;

  const [, dia, mes, ano] = match;
  return new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
}

function formatDataBR(data) {
  if (!data) return '';
  const d = new Date(data);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatDataHoraBR(data) {
  const d = new Date(data);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${min}`;
}

// Devolve o material no formato que o app espera (validade como texto).
function serializeMaterial(material) {
  return { ...material, validade: formatDataBR(material.validade) };
}

// Recebe os dados crus do formulário e devolve um objeto pronto pra
// salvar no banco, com os números já calculados. Nunca confiamos em
// "quantidadeTotal" vindo do front-end — ela é sempre recalculada aqui.
function normalizePayload(body) {
  const unidadeMedida = (body.unidadeMedida || '').trim() || 'Unidade';

  // Se a unidade for "Unidade", não faz sentido ter fator de conversão.
  const fatorConversao =
    unidadeMedida === 'Unidade' ? 1 : Number(body.fatorConversao) || 1;

  const quantidade = Number(body.quantidade) || 0;

  // Vazio/ausente = 0 (sem alerta de estoque baixo). A validação já
  // garantiu que, se veio preenchido, é um inteiro válido.
  const estoqueMinimo = Number(body.estoqueMinimo) || 0;

  return {
    nome: (body.nome || '').trim(),
    categoria: body.categoria,
    unidadeMedida,
    fatorConversao,
    quantidade,
    quantidadeTotal: quantidade * fatorConversao,
    estoqueMinimo,
    validade: parseDataBR(body.validade),
    ca: body.ca?.trim() || null,
  };
}

const ESTOQUE_MINIMO_MAXIMO = 1000000;

function validatePayload(body) {
  if (!body.nome || !body.nome.trim()) {
    return 'Informe o nome do material.';
  }
  if (!body.categoria) {
    return 'Informe a categoria do material.';
  }
  if (
    body.quantidade === undefined ||
    body.quantidade === null ||
    body.quantidade === '' ||
    Number.isNaN(Number(body.quantidade)) ||
    Number(body.quantidade) < 0
  ) {
    return 'Quantidade precisa ser um número válido.';
  }

  // Estoque mínimo é opcional (vazio = sem alerta), mas se vier
  // preenchido precisa ser um número inteiro, de 0 até o limite.
  if (
    body.estoqueMinimo !== undefined &&
    body.estoqueMinimo !== null &&
    String(body.estoqueMinimo).trim() !== ''
  ) {
    const minimo = Number(body.estoqueMinimo);
    if (!Number.isInteger(minimo) || minimo < 0 || minimo > ESTOQUE_MINIMO_MAXIMO) {
      return `Estoque mínimo precisa ser um número inteiro entre 0 e ${ESTOQUE_MINIMO_MAXIMO}.`;
    }
  }

  // Bloqueia datas absurdas (ex: "1500", digitado por engano em vez de
  // "2500" ou de um ano de verdade). Não exige que seja uma data futura
  // — só que esteja num intervalo plausível pra uma validade de material.
  if (body.validade && body.validade.trim()) {
    const dataValidade = parseDataBR(body.validade);
    if (!dataValidade) {
      return 'Data de validade inválida. Use o formato dd/mm/aaaa.';
    }
    const ano = dataValidade.getUTCFullYear();
    const anoAtual = new Date().getUTCFullYear();
    if (ano < 1900 || ano > anoAtual + 100) {
      return `Ano de validade inválido (${ano}). Confira a data digitada.`;
    }
  }

  return null;
}

// ---------------------------------------------------------------
// CRUD (restrito a admin/coordenador — ver material.routes.js).
// listMaterials é a exceção: professor também acessa (só leitura),
// porque a tela de Estoque reaproveita esse mesmo endpoint.
// ---------------------------------------------------------------

async function listMaterials(req, res) {
  try {
    // Tela de Materiais (admin/coordenador) chama sem filtro e enxerga
    // ativos e inativos, pra poder reativar quem foi inativado.
    //
    // Tela de Estoque chama com ?ativo=true: só material ATIVO aparece
    // no Estoque — essa é a regra de sincronização entre as duas telas
    // (material inativado some do Estoque, mas continua existindo aqui).
    const where = {};
    if (req.query.ativo === 'true') {
      where.ativo = true;
    } else if (req.query.ativo === 'false') {
      where.ativo = false;
    }

    const materials = await prisma.material.findMany({
      where,
      orderBy: { nome: 'asc' },
    });

    return res.json({ materials: materials.map(serializeMaterial) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar materiais.' });
  }
}

async function createMaterial(req, res) {
  try {
    const validationError = validatePayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const data = normalizePayload(req.body);

    const material = await prisma.material.create({
      data: { ...data, criadoPorId: req.userId },
    });

    return res.status(201).json({ material: serializeMaterial(material) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar material.' });
  }
}

async function updateMaterial(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Id inválido.' });
    }

    const validationError = validatePayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const data = normalizePayload(req.body);

    const material = await prisma.material.update({ where: { id }, data });

    return res.json({ material: serializeMaterial(material) });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Material não encontrado.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao atualizar material.' });
  }
}

async function setMaterialActive(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Id inválido.' });
    }

    const material = await prisma.material.update({
      where: { id },
      data: { ativo: !!req.body.ativo },
    });

    return res.json({ material: serializeMaterial(material) });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Material não encontrado.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao atualizar status do material.' });
  }
}

async function deleteMaterial(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Id inválido.' });
    }

    await prisma.material.delete({ where: { id } });

    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Material não encontrado.' });
    }
    // P2003 = violação de chave estrangeira: esse material já tem
    // movimentações (entradas/saídas) ou solicitações de alunos
    // registradas, então excluir quebraria o histórico. Em vez de forçar a exclusão, orienta a inativar.
    if (error.code === 'P2003') {
      return res.status(409).json({
        error:
          'Não é possível excluir esse material porque já existem movimentações (entradas/saídas) ou solicitações de alunos registradas para ele. Inative o material em vez de excluí-lo — assim ele deixa de aparecer no Estoque, mas o histórico é preservado.',
      });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao excluir material.' });
  }
}

// ---------------------------------------------------------------
// RETIRAR / DEVOLVER
//
// Diferente do updateMaterial (edição livre dos dados cadastrais),
// essas duas ações mexem só na quantidade em estoque e, além disso,
// registram uma Movimentacao — é o que aparece na tela "Movimentações".
//
// Permissões (ver material.routes.js):
//   retirar / devolver -> admin, coordenador e professor
//   (essas são as ações da tela de Estoque: "Retirar item" e
//   "Adicionar item" — os três papéis podem movimentar quantidade,
//   mesmo quem não administra o cadastro de materiais)
//
// Como funciona (igual à aprovação de solicitações):
//   tudo roda numa transação e a alteração do saldo é CONDICIONAL —
//   "só baixa se ainda houver quantidade suficiente" é decidido pelo
//   próprio banco, no mesmo comando que altera o saldo. Assim, duas
//   pessoas retirando ao mesmo tempo nunca passam do que existe em
//   estoque, e uma devolução nunca apaga a outra (o saldo é
//   incrementado/decrementado, não sobrescrito com um valor lido antes).
// ---------------------------------------------------------------

// Maior número que cabe num campo Int do banco (4 bytes).
const INT_MAXIMO = 2147483647;

// Teto por operação: segura digitação errada (ex: um "0" a mais) e
// evita estourar o campo Int do banco.
const MOVIMENTACAO_QUANTIDADE_MAXIMA = 1000000;

// Erro "esperado" (regra de negócio) com o status HTTP que deve voltar.
class ErroMovimentacao extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Aceita só número inteiro maior que zero. Recusa decimal ("2.5"),
// notação científica ("1e3"), texto, vazio e negativo.
function lerQuantidadeMovimentacao(valor) {
  const texto = String(valor ?? '').trim();

  if (!/^\d+$/.test(texto) || Number(texto) <= 0) {
    throw new ErroMovimentacao(
      400,
      'Informe uma quantidade válida: um número inteiro maior que zero.'
    );
  }

  const quantidade = Number(texto);
  if (quantidade > MOVIMENTACAO_QUANTIDADE_MAXIMA) {
    throw new ErroMovimentacao(
      400,
      `A quantidade máxima por operação é ${MOVIMENTACAO_QUANTIDADE_MAXIMA}.`
    );
  }

  return quantidade;
}

function erroEstoqueInsuficiente(material) {
  return new ErroMovimentacao(
    400,
    `Estoque insuficiente. Disponível: ${material.quantidade} ${material.unidadeMedida.toLowerCase()}(s).`
  );
}

// tipo: 'saida' (retirar) ou 'entrada' (devolver/adicionar).
// Devolve { materialAtualizado, movimentacao } ou lança ErroMovimentacao.
async function movimentarEstoque({ id, quantidade, tipo, responsavelId }) {
  const saida = tipo === 'saida';

  return prisma.$transaction(async (tx) => {
    const material = await tx.material.findUnique({ where: { id } });

    if (!material) {
      throw new ErroMovimentacao(404, 'Material não encontrado.');
    }
    if (!material.ativo) {
      throw new ErroMovimentacao(400, 'Esse material está inativo.');
    }

    // Mensagem clara logo de cara (a trava de verdade é a condição do
    // updateMany logo abaixo, que vale mesmo com outra pessoa mexendo).
    if (saida && material.quantidade < quantidade) {
      throw erroEstoqueInsuficiente(material);
    }
    if (
      !saida &&
      (material.quantidade + quantidade) * material.fatorConversao > INT_MAXIMO
    ) {
      throw new ErroMovimentacao(
        400,
        'Essa quantidade deixaria o total em estoque grande demais. Confira o número digitado.'
      );
    }

    // quantidadeTotal = quantidade * fatorConversao, então os dois
    // mudam na mesma proporção.
    const total = quantidade * material.fatorConversao;

    const alterado = await tx.material.updateMany({
      where: {
        id,
        ativo: true,
        // se alguém editou o fator de conversão agora há pouco, o
        // cálculo acima ficou velho — melhor recusar do que gravar errado
        fatorConversao: material.fatorConversao,
        ...(saida ? { quantidade: { gte: quantidade } } : {}),
      },
      data: saida
        ? {
            quantidade: { decrement: quantidade },
            quantidadeTotal: { decrement: total },
          }
        : {
            quantidade: { increment: quantidade },
            quantidadeTotal: { increment: total },
          },
    });

    if (alterado.count === 0) {
      // Outra pessoa mexeu no material entre a leitura e a gravação.
      // Lança o erro (desfaz a transação) explicando o que aconteceu.
      const atual = await tx.material.findUnique({ where: { id } });

      if (!atual) {
        throw new ErroMovimentacao(404, 'Material não encontrado.');
      }
      if (!atual.ativo) {
        throw new ErroMovimentacao(400, 'Esse material está inativo.');
      }
      if (saida && atual.quantidade < quantidade) {
        throw erroEstoqueInsuficiente(atual);
      }
      throw new ErroMovimentacao(
        409,
        'Esse material foi alterado por outra pessoa agora há pouco. Atualize a lista e tente de novo.'
      );
    }

    const movimentacao = await tx.movimentacao.create({
      data: { tipo, quantidade, materialId: id, responsavelId },
    });

    const materialAtualizado = await tx.material.findUnique({ where: { id } });

    return { materialAtualizado, movimentacao };
  });
}

function criarHandlerMovimentacao(tipo, mensagemErro) {
  return async function handlerMovimentacao(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ErroMovimentacao(400, 'Id inválido.');
      }

      const quantidade = lerQuantidadeMovimentacao(req.body?.quantidade);

      const { materialAtualizado, movimentacao } = await movimentarEstoque({
        id,
        quantidade,
        tipo,
        responsavelId: req.userId,
      });

      return res.json({ material: serializeMaterial(materialAtualizado), movimentacao });
    } catch (error) {
      if (error instanceof ErroMovimentacao) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error(error);
      return res.status(500).json({ error: mensagemErro });
    }
  };
}

const retirar = criarHandlerMovimentacao('saida', 'Erro ao retirar material.');
const devolver = criarHandlerMovimentacao('entrada', 'Erro ao devolver material.');

// ---------------------------------------------------------------
// RESUMO — números reais pra Tela Inicial (antes eram fixos: 5, 3, 1).
//
//   totalCadastrados   -> quantos materiais existem no sistema (ativos
//                         e inativos — "cadastrados" conta todo mundo).
//   divergencias       -> materiais ATIVOS cuja validade já passou
//                         ("itens fora da validade").
//   proximosDaValidade -> materiais ATIVOS que ainda não venceram, mas
//                         vencem nos próximos 30 dias (o aviso do topo
//                         da Tela Inicial).
//   auditados          -> materiais ATIVOS que já tiveram pelo menos
//                         uma movimentação (retirada ou devolução)
//                         registrada — ou seja, já foram conferidos
//                         pelo menos uma vez no sistema. Não existe
//                         ainda um recurso de "marcar como auditado";
//                         essa é a aproximação mais razoável com o que
//                         já existe. Se a intenção for outra (um botão
//                         de "auditar" separado, por exemplo), dá pra
//                         trocar essa regra facilmente.
// ---------------------------------------------------------------

async function resumo(req, res) {
  try {
    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);

    const em30Dias = new Date(hoje);
    em30Dias.setUTCDate(em30Dias.getUTCDate() + 30);

    const [totalCadastrados, divergencias, proximosDaValidade, auditados] =
      await Promise.all([
        prisma.material.count(),
        prisma.material.count({
          where: { ativo: true, validade: { not: null, lt: hoje } },
        }),
        prisma.material.count({
          where: {
            ativo: true,
            validade: { not: null, gte: hoje, lte: em30Dias },
          },
        }),
        prisma.material.count({
          where: { ativo: true, movimentacoes: { some: {} } },
        }),
      ]);

    return res.json({ totalCadastrados, divergencias, proximosDaValidade, auditados });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar resumo do estoque.' });
  }
}

module.exports = {
  listMaterials,
  createMaterial,
  updateMaterial,
  setMaterialActive,
  deleteMaterial,
  retirar,
  devolver,
  resumo,
  // exportados só para o movimentacao.controller.js reaproveitar a formatação
  formatDataHoraBR,
};