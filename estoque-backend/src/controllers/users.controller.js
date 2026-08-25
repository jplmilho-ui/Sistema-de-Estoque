const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const SENHA_MINIMA = 8;

async function listUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    if (password.length < SENHA_MINIMA) {
      return res.status(400).json({
        error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
      });
    }

    const finalRole = role === 'admin' ? 'admin' : 'user';

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Já existe um usuário com esse email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: finalRole },
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
    console.error(error);
    return res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
}

module.exports = { listUsers, createUser, deleteUser };
