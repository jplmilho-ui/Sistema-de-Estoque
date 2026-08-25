const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const SENHA_MINIMA = 8;

async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    if (password.length < SENHA_MINIMA) {
      return res.status(400).json({
        error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Já existe um usuário com esse email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Quem se cadastra sozinho pela tela pública sempre entra como "user".
    // Só um admin já existente pode promover alguém a admin, pela tela
    // de Gerenciar usuários (rota protegida /users).
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: 'user' },
    });

    const { password: _senha, ...userWithoutPassword } = user;

    return res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Mensagem de propósito genérica (não diz se foi o email ou a senha
    // que errou) — é o mesmo padrão usado por sites como bancos e Google,
    // pra não revelar quais emails estão cadastrados no sistema.
    const credenciaisInvalidas = () =>
      res.status(401).json({ error: 'Email ou senha inválidos.' });

    if (!user) {
      return credenciaisInvalidas();
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return credenciaisInvalidas();
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _senha, ...userWithoutPassword } = user;

    return res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao fazer login.' });
  }
}

module.exports = { register, login };
