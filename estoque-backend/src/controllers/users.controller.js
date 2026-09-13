const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const SENHA_MINIMA = 8;

async function listUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, rm: true, createdAt: true },
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
  super_admin: ['admin', 'professor', 'aluno'],
  admin: ['professor', 'aluno'],
};

async function createUser(req, res) {
  try {
    const { name, email, password, role, rm } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Nome, email, senha e tipo de conta são obrigatórios.' });
    }

    if (password.length < SENHA_MINIMA) {
      return res.status(400).json({
        error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
      });
    }

    // Só deixa criar o que a hierarquia permite: super_admin cria
    // admin/professor/aluno; admin cria só professor/aluno (nunca outro
    // admin, e nunca super_admin — essa conta só existe via seed).
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
        // (super_admin -> admin -> professor -> aluno).
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

    await prisma.user.delete({ where: { id } });

    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    // P2003 = violação de chave estrangeira: esse usuário já registrou
    // movimentações de estoque (retirou/adicionou material), então excluir
    // a conta quebraria o histórico de quem fez cada movimentação.
    if (error.code === 'P2003') {
      return res.status(409).json({
        error:
          'Não é possível excluir esse usuário porque ele possui movimentações de estoque registradas em seu nome. Para preservar o histórico, não é permitido excluir contas com movimentações vinculadas.',
      });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
}

module.exports = { listUsers, createUser, deleteUser };
