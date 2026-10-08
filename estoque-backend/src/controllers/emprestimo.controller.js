const prisma = require('../lib/prisma');

// ---------------------------------------------------------------
// EMPRÉSTIMO DE UNIFORME (aluno -> professor/coordenador/admin)
//
// Permissões (ver emprestimo.routes.js):
//   aluno                          -> pedir emprestado, ver os seus,
//                                     cancelar pedido pendente
//   admin, coordenador, professor  -> ver todos, CONFIRMAR ou recusar o
//                                     pedido e registrar a devolução
//
// Fluxo:
//   pendente -> emprestado (equipe confirma) -> devolvido (equipe recebe)
//   pendente -> recusado   (equipe recusa, com motivo opcional)
//   pendente -> cancelado  (o próprio aluno desiste)
//
// Regras importantes:
//   - O aluno só recebe o uniforme DEPOIS da confirmação de um professor,
//     coordenador ou admin. Enquanto o pedido está pendente, o estoque não
//     muda e nada aparece em Movimentações.
//   - Confirmar BAIXA o estoque e registra uma Movimentacao de saída em
//     nome de quem confirmou — tudo numa transação: ou faz tudo, ou nada.
//   - Quem responder primeiro encerra o pedido (confirmar/recusar só
//     funciona enquanto o status for "pendente").
//   - Ao registrar a devolução, o uniforme volta ao estoque e uma
//     Movimentacao do tipo "devolucao" é criada em nome de quem recebeu
//     (aparece como "Devolução" na tela de Movimentações).
//   - "Atrasado" não é gravado no banco: é calculado comparando a data
//     de devolução com o dia de hoje (no fuso de Brasília). Assim o
//     status nunca fica velho e não precisa de tarefa agendada.
// ---------------------------------------------------------------

const CATEGORIA_EMPRESTIMO = 'Uniforme';
const QUANTIDADE_MAXIMA = 20;
const TEXTO_MAXIMO = 300;
// Prazo máximo de um empréstimo, em dias a partir de hoje.
const PRAZO_MAXIMO_DIAS = 30;
// A partir de quantos dias antes do prazo o aluno passa a ser avisado.
const DIAS_AVISO_DEVOLUCAO = 2;
const DIAS_DEVOLVIDOS_RECENTES = 7;
const MAX_PENDENTES_POR_ALUNO = 5;
const MAX_DEVOLVIDOS_RECENTES = 30;

const MS_DIA = 24 * 60 * 60 * 1000;
// Maior número que cabe num campo Int do banco (4 bytes).
const INT_MAXIMO = 2147483647;

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

// ---------- datas ----------

// Hoje à meia-noite UTC, mas com o DIA de Brasília. O servidor (ex: Vercel)
// roda em UTC; sem isso, depois das 21h em Brasília o "hoje" já seria o
// dia seguinte e o empréstimo apareceria como atrasado cedo demais.
function hojeBrasil() {
  const texto = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // "AAAA-MM-DD"

  const [ano, mes, dia] = texto.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// "DD/MM/AAAA" -> Date (meia-noite UTC). Devolve null se não existir no
// calendário (31/02/2026 é rejeitado).
function lerDataBR(texto) {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto ?? '').trim());
  if (!partes) return null;

  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const ano = Number(partes[3]);

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia;

  return existe ? data : null;
}

function formatDataBR(data) {
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

// Quantos dias faltam do dia de hoje até a data (negativo = já passou).
function diasAte(data, hoje) {
  return Math.round((data.getTime() - hoje.getTime()) / MS_DIA);
}

// ---------- formatação ----------

// "2 caixas (100 un.)" / "5 un." — mesmo formato das outras telas.
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
  recebidoPor: { select: { name: true } },
  respondidoPor: { select: { name: true } },
};

// Formato que o app recebe. As datas de devolução já vão em "DD/MM/AAAA"
// (é o que a tela e o PDF mostram); `criadoEm`/`devolvidoEm` vão em ISO.
function serializeEmprestimo(e, hoje = hojeBrasil()) {
  const emAberto = e.status === 'emprestado';
  const dias = diasAte(e.dataDevolucaoPrevista, hoje);

  return {
    id: e.id,
    status: e.status,
    quantidade: e.quantidade,
    quantidadeTexto: formatQuantidade(e.quantidade, e.material),
    observacao: e.observacao,
    materialNome: e.material.nome,
    categoria: e.material.categoria,
    unidadeMedida: e.material.unidadeMedida,
    alunoNome: e.aluno.name,
    alunoRm: e.aluno.rm,
    dataDevolucao: formatDataBR(e.dataDevolucaoPrevista),
    motivoRecusa: e.motivoRecusa,
    respondidoPorNome: e.respondidoPor ? e.respondidoPor.name : null,
    respondidoEm: e.respondidoEm ? e.respondidoEm.toISOString() : null,
    // Só faz sentido enquanto o uniforme está com o aluno (confirmado e
    // ainda não devolvido).
    diasParaDevolucao: emAberto ? dias : null,
    atrasado: emAberto && dias < 0,
    venceEmBreve: emAberto && dias >= 0 && dias <= DIAS_AVISO_DEVOLUCAO,
    criadoEm: e.createdAt.toISOString(),
    devolvidoEm: e.devolvidoEm ? e.devolvidoEm.toISOString() : null,
    recebidoPorNome: e.recebidoPor ? e.recebidoPor.name : null,
  };
}

// ---------------------------------------------------------------
// ALUNO
// ---------------------------------------------------------------

// Uniformes que o aluno pode pedir emprestado (ativos e com estoque).
async function listMateriaisDisponiveis(req, res) {
  try {
    const materiais = await prisma.material.findMany({
      where: {
        ativo: true,
        quantidade: { gt: 0 },
        categoria: CATEGORIA_EMPRESTIMO,
      },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        categoria: true,
        unidadeMedida: true,
        fatorConversao: true,
        quantidade: true,
      },
    });

    return res.json({
      materiais,
      regras: { prazoMaximoDias: PRAZO_MAXIMO_DIAS, quantidadeMaxima: QUANTIDADE_MAXIMA },
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar uniformes.');
  }
}

async function criarEmprestimo(req, res) {
  try {
    const materialId = parseId(req.body.materialId);
    const quantidade = Number(req.body.quantidade);
    const observacao = textoOpcional(req.body.observacao, 'A observação');

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new ErroNegocio(400, 'Informe uma quantidade válida, maior que zero.');
    }
    if (quantidade > QUANTIDADE_MAXIMA) {
      throw new ErroNegocio(400, `A quantidade máxima por empréstimo é ${QUANTIDADE_MAXIMA}.`);
    }

    const dataDevolucao = lerDataBR(req.body.dataDevolucao);
    if (!dataDevolucao) {
      throw new ErroNegocio(400, 'Informe a data de devolução no formato DD/MM/AAAA.');
    }

    const hoje = hojeBrasil();
    const dias = diasAte(dataDevolucao, hoje);
    if (dias < 0) {
      throw new ErroNegocio(400, 'A data de devolução não pode ser anterior a hoje.');
    }
    if (dias > PRAZO_MAXIMO_DIAS) {
      throw new ErroNegocio(
        400,
        `O prazo máximo de empréstimo é ${PRAZO_MAXIMO_DIAS} dias a partir de hoje.`
      );
    }

    const material = await prisma.material.findUnique({ where: { id: materialId } });

    if (!material || !material.ativo || material.categoria !== CATEGORIA_EMPRESTIMO) {
      throw new ErroNegocio(404, 'Uniforme não encontrado ou indisponível para empréstimo.');
    }
    if (material.quantidade <= 0) {
      throw new ErroNegocio(400, 'Esse uniforme está sem estoque no momento.');
    }
    if (quantidade > material.quantidade) {
      throw new ErroNegocio(
        400,
        `Quantidade indisponível. Disponível: ${material.quantidade} ${material.unidadeMedida.toLowerCase()}(s).`
      );
    }

    // Evita o aluno encher a fila de confirmação com pedidos repetidos.
    const pendentes = await prisma.emprestimo.count({
      where: { alunoId: req.userId, status: 'pendente' },
    });
    if (pendentes >= MAX_PENDENTES_POR_ALUNO) {
      throw new ErroNegocio(
        400,
        'Você já tem pedidos de empréstimo aguardando confirmação. Espere a resposta ou cancele algum antes de pedir outro.'
      );
    }

    // O pedido nasce PENDENTE: o estoque só é baixado (e a saída só entra
    // em Movimentações) quando um professor/coordenador/admin confirma.
    const criado = await prisma.emprestimo.create({
      data: {
        alunoId: req.userId,
        materialId: material.id,
        quantidade,
        observacao,
        dataDevolucaoPrevista: dataDevolucao,
        status: 'pendente',
      },
      include: INCLUDE_COMPLETO,
    });

    return res.status(201).json({ emprestimo: serializeEmprestimo(criado, hoje) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao registrar empréstimo.');
  }
}

// Desiste de um pedido que ainda está pendente.
async function cancelarEmprestimo(req, res) {
  try {
    const id = parseId(req.params.id);

    // Só cancela o PRÓPRIO pedido e só enquanto estiver pendente.
    // updateMany com essa condição evita corrida com uma confirmação.
    const resultado = await prisma.emprestimo.updateMany({
      where: { id, alunoId: req.userId, status: 'pendente' },
      data: { status: 'cancelado' },
    });

    if (resultado.count === 0) {
      const existe = await prisma.emprestimo.findFirst({
        where: { id, alunoId: req.userId },
      });
      if (!existe) throw new ErroNegocio(404, 'Empréstimo não encontrado.');
      throw new ErroNegocio(409, 'Esse pedido já foi respondido e não pode mais ser cancelado.');
    }

    const emprestimo = await prisma.emprestimo.findUnique({
      where: { id },
      include: INCLUDE_COMPLETO,
    });

    return res.json({ emprestimo: serializeEmprestimo(emprestimo) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao cancelar pedido de empréstimo.');
  }
}

async function listMeusEmprestimos(req, res) {
  try {
    const emprestimos = await prisma.emprestimo.findMany({
      where: { alunoId: req.userId },
      include: INCLUDE_COMPLETO,
      orderBy: { createdAt: 'desc' },
    });

    const hoje = hojeBrasil();
    return res.json({
      emprestimos: emprestimos.map((e) => serializeEmprestimo(e, hoje)),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar seus empréstimos.');
  }
}

// ---------------------------------------------------------------
// ADMIN / COORDENADOR / PROFESSOR
// ---------------------------------------------------------------

// Pedidos pendentes (mais antigos primeiro) + todos os empréstimos em
// aberto (os que vencem antes primeiro, então os atrasados ficam no topo)
// + os devolvidos na última semana.
async function listEmprestimos(req, res) {
  try {
    const desde = new Date(Date.now() - DIAS_DEVOLVIDOS_RECENTES * MS_DIA);

    const [pendentes, emAberto, devolvidos] = await Promise.all([
      prisma.emprestimo.findMany({
        where: { status: 'pendente' },
        include: INCLUDE_COMPLETO,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.emprestimo.findMany({
        where: { status: 'emprestado' },
        include: INCLUDE_COMPLETO,
        orderBy: [{ dataDevolucaoPrevista: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.emprestimo.findMany({
        where: { status: 'devolvido', devolvidoEm: { gte: desde } },
        include: INCLUDE_COMPLETO,
        orderBy: { devolvidoEm: 'desc' },
        take: MAX_DEVOLVIDOS_RECENTES,
      }),
    ]);

    const hoje = hojeBrasil();
    return res.json({
      emprestimos: [...pendentes, ...emAberto, ...devolvidos].map((e) =>
        serializeEmprestimo(e, hoje)
      ),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar empréstimos.');
  }
}

// CONFIRMA o pedido: o uniforme sai do estoque e a saída é registrada em
// Movimentações, em nome de quem confirmou. Tudo numa transação.
async function aprovarEmprestimo(req, res) {
  try {
    const id = parseId(req.params.id);

    await prisma.$transaction(async (tx) => {
      const emprestimo = await tx.emprestimo.findUnique({
        where: { id },
        include: { material: true },
      });

      if (!emprestimo) throw new ErroNegocio(404, 'Empréstimo não encontrado.');
      if (emprestimo.status !== 'pendente') {
        throw new ErroNegocio(409, 'Esse pedido já foi respondido.');
      }

      const { material, quantidade } = emprestimo;
      if (!material.ativo) {
        throw new ErroNegocio(400, 'Esse uniforme está inativo.');
      }

      // Se o dia combinado já passou enquanto o pedido esperava, não faz
      // sentido emprestar com prazo vencido: a equipe recusa e o aluno
      // refaz o pedido com uma data nova.
      if (diasAte(emprestimo.dataDevolucaoPrevista, hojeBrasil()) < 0) {
        throw new ErroNegocio(
          400,
          'A data de devolução pedida já passou. Recuse o pedido para o aluno refazer com uma data nova.'
        );
      }

      // 1) "Reserva" a resposta: só passa quem encontrar o pedido ainda
      //    pendente. Se duas pessoas confirmarem juntas, só uma vence.
      const marcado = await tx.emprestimo.updateMany({
        where: { id, status: 'pendente' },
        data: { status: 'emprestado', respondidoPorId: req.userId, respondidoEm: new Date() },
      });
      if (marcado.count === 0) {
        throw new ErroNegocio(409, 'Esse pedido já foi respondido.');
      }

      // 2) Baixa o estoque só se ainda houver quantidade suficiente. A
      //    condição vale no próprio comando do banco, então dois pedidos
      //    confirmados juntos nunca passam do estoque.
      //    quantidadeTotal = quantidade * fatorConversao: baixa os dois na
      //    mesma proporção.
      const baixa = await tx.material.updateMany({
        where: {
          id: material.id,
          ativo: true,
          // se alguém editou o fator de conversão agora há pouco, o cálculo
          // ficou velho — melhor recusar do que gravar errado
          fatorConversao: material.fatorConversao,
          quantidade: { gte: quantidade },
        },
        data: {
          quantidade: { decrement: quantidade },
          quantidadeTotal: { decrement: quantidade * material.fatorConversao },
        },
      });
      if (baixa.count === 0) {
        const atual = await tx.material.findUnique({ where: { id: material.id } });
        // Lançar o erro desfaz a "reserva" do passo 1 (rollback).
        throw new ErroNegocio(
          409,
          `Estoque insuficiente ou alterado agora há pouco. Disponível: ${atual ? atual.quantidade : 0} ${material.unidadeMedida.toLowerCase()}(s).`
        );
      }

      // 3) Registra a saída em Movimentações, em nome de quem confirmou.
      await tx.movimentacao.create({
        data: { tipo: 'saida', quantidade, materialId: material.id, responsavelId: req.userId },
      });
    });

    const aprovado = await prisma.emprestimo.findUnique({
      where: { id },
      include: INCLUDE_COMPLETO,
    });

    return res.json({ emprestimo: serializeEmprestimo(aprovado) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao confirmar empréstimo.');
  }
}

async function recusarEmprestimo(req, res) {
  try {
    const id = parseId(req.params.id);
    const motivo = textoOpcional(req.body?.motivo, 'O motivo');

    const resultado = await prisma.emprestimo.updateMany({
      where: { id, status: 'pendente' },
      data: {
        status: 'recusado',
        motivoRecusa: motivo,
        respondidoPorId: req.userId,
        respondidoEm: new Date(),
      },
    });

    if (resultado.count === 0) {
      const existe = await prisma.emprestimo.findUnique({ where: { id } });
      if (!existe) throw new ErroNegocio(404, 'Empréstimo não encontrado.');
      throw new ErroNegocio(409, 'Esse pedido já foi respondido.');
    }

    const recusado = await prisma.emprestimo.findUnique({
      where: { id },
      include: INCLUDE_COMPLETO,
    });

    return res.json({ emprestimo: serializeEmprestimo(recusado) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao recusar empréstimo.');
  }
}

// Registra que o uniforme voltou: devolve ao estoque e cria a devolução em
// Movimentações em nome de quem recebeu.
async function devolverEmprestimo(req, res) {
  try {
    const id = parseId(req.params.id);

    await prisma.$transaction(async (tx) => {
      const emprestimo = await tx.emprestimo.findUnique({ where: { id } });

      if (!emprestimo) throw new ErroNegocio(404, 'Empréstimo não encontrado.');
      if (emprestimo.status !== 'emprestado') {
        throw new ErroNegocio(409, 'Esse empréstimo já foi devolvido.');
      }

      // 1) "Reserva" a devolução: só passa quem encontrar o empréstimo
      //    ainda em aberto. Se duas pessoas registrarem juntas, só uma vence.
      const marcado = await tx.emprestimo.updateMany({
        where: { id, status: 'emprestado' },
        data: { status: 'devolvido', devolvidoEm: new Date(), recebidoPorId: req.userId },
      });
      if (marcado.count === 0) {
        throw new ErroNegocio(409, 'Esse empréstimo já foi devolvido.');
      }

      // 2) Devolve ao estoque. Não exige material ativo: se ele foi
      //    inativado enquanto estava emprestado, o uniforme voltou do mesmo
      //    jeito. Usa o fator de conversão ATUAL do material.
      const { quantidade, materialId } = emprestimo;
      const material = await tx.material.findUnique({ where: { id: materialId } });
      if (!material) throw new ErroNegocio(404, 'Material não encontrado.');

      if ((material.quantidade + quantidade) * material.fatorConversao > INT_MAXIMO) {
        throw new ErroNegocio(400, 'Essa devolução deixaria o total em estoque grande demais.');
      }

      const alterado = await tx.material.updateMany({
        where: { id: materialId, fatorConversao: material.fatorConversao },
        data: {
          quantidade: { increment: quantidade },
          quantidadeTotal: { increment: quantidade * material.fatorConversao },
        },
      });
      if (alterado.count === 0) {
        throw new ErroNegocio(
          409,
          'Esse material foi alterado por outra pessoa agora há pouco. Atualize a lista e tente de novo.'
        );
      }

      // 3) Registra a devolução em Movimentações, em nome de quem recebeu.
      await tx.movimentacao.create({
        data: { tipo: 'devolucao', quantidade, materialId, responsavelId: req.userId },
      });
    });

    const devolvido = await prisma.emprestimo.findUnique({
      where: { id },
      include: INCLUDE_COMPLETO,
    });

    return res.json({ emprestimo: serializeEmprestimo(devolvido) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao registrar devolução.');
  }
}

module.exports = {
  listMateriaisDisponiveis,
  criarEmprestimo,
  listMeusEmprestimos,
  cancelarEmprestimo,
  listEmprestimos,
  aprovarEmprestimo,
  recusarEmprestimo,
  devolverEmprestimo,
  // exportados só para teste
  _internos: { hojeBrasil, lerDataBR, formatDataBR, diasAte, serializeEmprestimo },
};
