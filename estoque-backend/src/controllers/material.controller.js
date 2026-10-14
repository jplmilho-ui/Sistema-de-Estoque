const prisma = require('../lib/prisma');
const { ErroNegocio } = require('../lib/erros');
const { hojeBrasil, formatDataHoraBR } = require('../lib/datas');
const {
  INT_MAXIMO,
  lerQuantidadePositiva,
  lerEntrada,
  paraUnidades,
  formatQuantidade,
  descreverEstoque,
} = require('../lib/quantidade');

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

// Devolve o material no formato que o app espera (validade como texto).
// O saldo vem do banco em unidades (quantidadeTotal); aqui acrescentamos
// as embalagens fechadas (quantidade), as unidades avulsas e o texto pronto.
function serializeMaterial(material) {
  return {
    ...material,
    validade: formatDataBR(material.validade),
    ...descreverEstoque(material),
  };
}

// Recebe os dados crus do formulário e devolve um objeto pronto pra
// salvar no banco.
//
// SALDO: só é definido na CRIAÇÃO (quantidade informada em embalagens x
// fator = unidades). Na EDIÇÃO o saldo não é tocado: quem muda o estoque
// é Adicionar/Retirar na tela de Estoque, que registra a movimentação e
// não sobrescreve o que outra pessoa fez nesse meio tempo. Se o fator de
// conversão for corrigido na edição, o total em UNIDADES continua o mesmo.
function lerBooleano(valor) {
  if (valor === undefined || valor === null || valor === '') return undefined;
  return valor === true || valor === 'true';
}

function normalizePayload(body, { criando = false } = {}) {
  const unidadeMedida = (body.unidadeMedida || '').trim() || 'Unidade';

  // Se a unidade for "Unidade", não faz sentido ter fator de conversão.
  const fatorConversao =
    unidadeMedida === 'Unidade' ? 1 : Number(body.fatorConversao) || 1;

  // Vazio/ausente = 0 (sem alerta de estoque baixo). A validação já
  // garantiu que, se veio preenchido, é um inteiro válido.
  const estoqueMinimo = Number(body.estoqueMinimo) || 0;

  const data = {
    nome: (body.nome || '').trim(),
    categoria: body.categoria,
    unidadeMedida,
    fatorConversao,
    estoqueMinimo,
    permiteFracionar: lerBooleano(body.permiteFracionar),
    validade: parseDataBR(body.validade),
    ca: body.ca?.trim() || null,
  };

  if (criando) {
    data.quantidadeTotal = Number(body.quantidade) * fatorConversao;
  }

  return data;
}

const ESTOQUE_MINIMO_MAXIMO = 1000000;
const FATOR_MAXIMO = 1000000;

function validatePayload(body, { criando = false } = {}) {
  if (!body.nome || !body.nome.trim()) {
    return 'Informe o nome do material.';
  }
  if (!body.categoria) {
    return 'Informe a categoria do material.';
  }

  // Fator de conversão: quantas unidades cabem em 1 embalagem. Precisa ser
  // inteiro >= 1 (nada de 0,5, de negativo ou de texto).
  const unidade = String(body.unidadeMedida ?? '').trim() || 'Unidade';
  let fator = 1;
  if (unidade !== 'Unidade') {
    const textoFator = String(body.fatorConversao ?? '').trim();
    if (!/^\d+$/.test(textoFator) || Number(textoFator) < 1 || Number(textoFator) > FATOR_MAXIMO) {
      return `Informe quantas unidades tem em cada embalagem: um número inteiro de 1 a ${FATOR_MAXIMO}.`;
    }
    fator = Number(textoFator);
  }

  // O saldo só é informado na criação (na edição ele não muda).
  if (criando) {
    const textoQtd = String(body.quantidade ?? '').trim();
    if (!/^\d+$/.test(textoQtd)) {
      return 'Quantidade precisa ser um número inteiro (0 ou mais).';
    }
    if (Number(textoQtd) * fator > INT_MAXIMO) {
      return 'Quantidade grande demais. Confira o número digitado.';
    }
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
    const validationError = validatePayload(req.body, { criando: true });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const data = normalizePayload(req.body, { criando: true });

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
//
//   A quantidade pode ser digitada em EMBALAGENS (ex: 1 caixa) ou em
//   UNIDADES AVULSAS (ex: 1 un.): o campo "unidade" do corpo diz qual.
//   O saldo e a movimentação são sempre gravados em unidades.
// ---------------------------------------------------------------

// Teto por operação, em UNIDADES: segura digitação errada (ex: um "0" a
// mais) e evita estourar o campo Int do banco.
const MOVIMENTACAO_QUANTIDADE_MAXIMA = 1000000;

function erroEstoqueInsuficiente(material) {
  return new ErroNegocio(
    400,
    `Estoque insuficiente. Disponível: ${formatQuantidade(material.quantidadeTotal, material)}.`
  );
}

// tipo: 'saida' (retirar) ou 'entrada' (devolver/adicionar).
// `entrada`: em que unidade a pessoa digitou — 'embalagem' (ex: caixas) ou
// 'unidade' (avulsas). Tudo é convertido para UNIDADES aqui dentro.
// Devolve { materialAtualizado, movimentacao } ou lança ErroNegocio.
async function movimentarEstoque({ id, quantidade, entrada, tipo, responsavelId }) {
  const saida = tipo === 'saida';

  return prisma.$transaction(async (tx) => {
    const material = await tx.material.findUnique({ where: { id } });

    if (!material) {
      throw new ErroNegocio(404, 'Material não encontrado.');
    }
    if (!material.ativo) {
      throw new ErroNegocio(400, 'Esse material está inativo.');
    }

    const unidades = paraUnidades(
      quantidade,
      entrada,
      material,
      MOVIMENTACAO_QUANTIDADE_MAXIMA,
      'operação'
    );

    // Mensagem clara logo de cara (a trava de verdade é a condição do
    // updateMany logo abaixo, que vale mesmo com outra pessoa mexendo).
    if (saida && material.quantidadeTotal < unidades) {
      throw erroEstoqueInsuficiente(material);
    }
    if (!saida && material.quantidadeTotal + unidades > INT_MAXIMO) {
      throw new ErroNegocio(
        400,
        'Essa quantidade deixaria o total em estoque grande demais. Confira o número digitado.'
      );
    }

    const alterado = await tx.material.updateMany({
      where: {
        id,
        ativo: true,
        // se alguém corrigiu o fator de conversão agora há pouco, a
        // conversão acima ficou velha — melhor recusar do que gravar errado
        fatorConversao: material.fatorConversao,
        quantidadeTotal: saida
          ? { gte: unidades }
          : { lte: INT_MAXIMO - unidades },
      },
      data: {
        quantidadeTotal: saida ? { decrement: unidades } : { increment: unidades },
      },
    });

    if (alterado.count === 0) {
      // Outra pessoa mexeu no material entre a leitura e a gravação.
      // Lança o erro (desfaz a transação) explicando o que aconteceu.
      const atual = await tx.material.findUnique({ where: { id } });

      if (!atual) {
        throw new ErroNegocio(404, 'Material não encontrado.');
      }
      if (!atual.ativo) {
        throw new ErroNegocio(400, 'Esse material está inativo.');
      }
      if (saida && atual.quantidadeTotal < unidades) {
        throw erroEstoqueInsuficiente(atual);
      }
      throw new ErroNegocio(
        409,
        'Esse material foi alterado por outra pessoa agora há pouco. Atualize a lista e tente de novo.'
      );
    }

    // A movimentação é gravada em UNIDADES.
    const movimentacao = await tx.movimentacao.create({
      data: { tipo, quantidade: unidades, materialId: id, responsavelId },
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
        throw new ErroNegocio(400, 'Id inválido.');
      }

      const quantidade = lerQuantidadePositiva(
        req.body?.quantidade,
        MOVIMENTACAO_QUANTIDADE_MAXIMA
      );
      const entrada = lerEntrada(req.body?.unidade);

      const { materialAtualizado, movimentacao } = await movimentarEstoque({
        id,
        quantidade,
        entrada,
        tipo,
        responsavelId: req.userId,
      });

      return res.json({ material: serializeMaterial(materialAtualizado), movimentacao });
    } catch (error) {
      if (error instanceof ErroNegocio) {
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
    // "Hoje" no dia de Brasília (o servidor roda em UTC; sem isso, depois
    // das 21h o "hoje" já seria o dia seguinte).
    const hoje = hojeBrasil();

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