const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const SENHA_MINIMA = 8;
const SENHA_MAXIMA = 72; // limite do bcrypt: o que passa disso seria ignorado em silêncio
const EMAIL_MINIMO = 8;
const RM_MAXIMO = 5; // o RM do aluno tem no máximo 5 caracteres
// Checagem simples de formato (algo@algo.algo) — não cobre todo caso
// de e-mail válido que existe, mas barra o óbvio (sem "@", sem domínio).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarEmail(email) {
  if (!email || email.trim().length < EMAIL_MINIMO) {
    return `O e-mail precisa ter pelo menos ${EMAIL_MINIMO} caracteres.`;
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return 'Informe um e-mail válido.';
  }
  return null;
}

// Campos de usuário que podem ir para o app (nunca o hash da senha).
const USER_PUBLICO = {
  id: true,
  name: true,
  email: true,
  role: true,
  rm: true,
  ativo: true,
  createdAt: true,
};

// Papéis que um coordenador NÃO alcança (desativar, redefinir senha,
// excluir): só o admin mexe em coordenador e admin.
const PAPEIS_FORA_DO_ALCANCE_DO_COORDENADOR = ['coordenador', 'admin'];

async function listUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      select: USER_PUBLICO,
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
}

// Quem está logado (req.userRole, preenchido pelo admin.middleware.js)
// define quais papéis ele tem permissão de criar por aqui.
const PAPEIS_QUE_PODE_CRIAR = {
  admin: ['coordenador', 'professor', 'aluno'],
  coordenador: ['professor', 'aluno'],
};

async function createUser(req, res) {
  try {
    const { name, email, password, role, rm } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Nome, email, senha e tipo de conta são obrigatórios.' });
    }

    const erroEmail = validarEmail(email);
    if (erroEmail) {
      return res.status(400).json({ error: erroEmail });
    }

    if (password.length < SENHA_MINIMA) {
      return res.status(400).json({
        error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
      });
    }

    // Só deixa criar o que a hierarquia permite: admin cria
    // coordenador/professor/aluno; coordenador cria só professor/aluno
    // (nunca outro coordenador, e nunca admin — essa conta só existe
    // via seed).
    const papeisPermitidos = PAPEIS_QUE_PODE_CRIAR[req.userRole] || [];
    if (!papeisPermitidos.includes(role)) {
      return res.status(403).json({
        error: 'Você não tem permissão para criar esse tipo de conta.',
      });
    }

    // Aluno precisa de RM (Registro do Aluno); os outros papéis não usam.
    if (role === 'aluno' && !rm?.trim()) {
      return res.status(400).json({ error: 'Informe o RM do aluno.' });
    }
    if (role === 'aluno' && rm.trim().length > RM_MAXIMO) {
      return res.status(400).json({
        error: `O RM do aluno pode ter no máximo ${RM_MAXIMO} caracteres.`,
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Já existe um usuário com esse email.' });
    }

    if (role === 'aluno') {
      const existingRm = await prisma.user.findUnique({ where: { rm: rm.trim() } });
      if (existingRm) {
        return res.status(409).json({ error: 'Já existe um aluno com esse RM.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        rm: role === 'aluno' ? rm.trim() : null,
        // Guarda quem criou a conta, pra manter o rastro da hierarquia
        // (admin -> coordenador -> professor -> aluno).
        criadoPorId: req.userId,
      },
    });

    const { password: _senha, ...userWithoutPassword } = user;

    return res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
}

async function deleteUser(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Id inválido.' });
    }

    if (id === req.userId) {
      return res.status(400).json({
        error: 'Você não pode excluir a própria conta enquanto está logado nela.',
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Coordenador não pode excluir outro coordenador nem o admin — só o
    // admin tem esse alcance. Sem essa checagem, um coordenador qualquer
    // conseguia remover até o admin, o que não faz sentido dentro da
    // hierarquia (admin -> coordenador -> professor -> aluno).
    if (req.userRole === 'coordenador' && PAPEIS_FORA_DO_ALCANCE_DO_COORDENADOR.includes(existingUser.role)) {
      return res.status(403).json({
        error: 'Um coordenador não pode excluir outro coordenador ou o admin.',
      });
    }

    await prisma.user.delete({ where: { id } });

    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    // P2003 = violação de chave estrangeira: esse usuário já registrou
    // movimentações de estoque (retirou/adicionou material) ou já
    // aprovou/recusou solicitações, então excluir a conta quebraria o
    // histórico de quem fez cada ação.
    if (error.code === 'P2003') {
      return res.status(409).json({
        error:
          'Não é possível excluir esse usuário porque ele possui movimentações de estoque, empréstimos ou respostas a solicitações registradas em seu nome. Para preservar o histórico, não é permitido excluir contas com esses registros vinculados.',
      });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
}

// ---------------------------------------------------------------
// DESATIVAR / REATIVAR
//
// Conta desativada não entra no sistema e perde a sessão na hora (o
// authMiddleware confere "ativo" no banco a cada requisição), mas o histórico
// dela continua intacto. É o caminho certo para quem saiu da escola e não
// pode ser excluído por já ter registros em seu nome.
// ---------------------------------------------------------------
async function setUserActive(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Id inválido.' });
    }

    // Só aceita true/false de verdade (nada de "false" em texto virar true).
    const ativo = req.body?.ativo;
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({ error: 'Informe "ativo" como verdadeiro ou falso.' });
    }

    if (id === req.userId) {
      return res.status(400).json({
        error: 'Você não pode desativar a própria conta enquanto está logado nela.',
      });
    }

    const alvo = await prisma.user.findUnique({ where: { id } });
    if (!alvo) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (
      req.userRole === 'coordenador' &&
      PAPEIS_FORA_DO_ALCANCE_DO_COORDENADOR.includes(alvo.role)
    ) {
      return res.status(403).json({
        error: 'Um coordenador não pode desativar outro coordenador ou o admin.',
      });
    }

    const user = await prisma.user.update({
      where: { id },
      // tokensValidosDesde: derruba sessões antigas. Assim, reativar a conta
      // não "ressuscita" um login velho que ficou guardado em algum aparelho.
      data: { ativo, tokensValidosDesde: new Date() },
      select: USER_PUBLICO,
    });

    return res.json({ user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao atualizar a conta.' });
  }
}

// ---------------------------------------------------------------
// REDEFINIR SENHA
//
// - Admin redefine a de qualquer pessoa; coordenador, a de professor e aluno.
// - Cada pessoa também pode trocar a PRÓPRIA senha por aqui, mas nesse caso
//   precisa informar a senha atual (um login esquecido aberto não basta).
// - Depois da troca, logins antigos da conta deixam de valer.
// ---------------------------------------------------------------
async function resetUserPassword(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Id inválido.' });
    }

    const { password } = req.body || {};

    if (typeof password !== 'string' || password.length < SENHA_MINIMA) {
      return res.status(400).json({
        error: `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
      });
    }
    if (password.length > SENHA_MAXIMA) {
      return res.status(400).json({
        error: `A nova senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`,
      });
    }

    if (id === req.userId) {
      return res.status(400).json({
        error: 'Para trocar a sua própria senha, use o seu perfil (ícone no canto superior direito).',
      });
    }

    const alvo = await prisma.user.findUnique({ where: { id } });
    if (!alvo) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (
      req.userRole === 'coordenador' &&
      PAPEIS_FORA_DO_ALCANCE_DO_COORDENADOR.includes(alvo.role)
    ) {
      return res.status(403).json({
        error: 'Um coordenador não pode redefinir a senha de outro coordenador ou do admin.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data: { password: hashedPassword, tokensValidosDesde: new Date() },
      select: USER_PUBLICO,
    });

    return res.json({ user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
}

module.exports = { listUsers, createUser, deleteUser, setUserActive, resetUserPassword };
