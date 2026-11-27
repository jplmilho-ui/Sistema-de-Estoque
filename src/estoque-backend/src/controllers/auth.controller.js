
// CONTROLE DE AUTENTICAÇÃO DO BACKEND

// importacação de bibliotecas
const bcrypt = require('bcryptjs'); //Criptografia de senhas
const jwt = require('jsonwebtoken'); // TOKEN PARA LOGAR AO SISTEMA 
const prisma = require('../lib/prisma'); //Conexão com o Prisma que permite o Node.js conversar com o Postgre
const { ehBancoDesatualizado, MENSAGEM_BANCO_DESATUALIZADO } = require('../lib/erros');

const SENHA_MINIMA = 8;
const SENHA_MAXIMA = 72; // limite do bcrypt: o que passa disso seria ignorado em silêncio
const NOME_MINIMO = 2;
const NOME_MAXIMO = 100;

// Dados do perfil que podem ir para o app (nunca o hash da senha).
const PERFIL = { id: true, name: true, email: true, role: true, rm: true };

// Erro inesperado: registra no log e, se for o caso típico de banco/Prisma
// Client desatualizado, devolve uma mensagem que diz o que fazer.
function erroServidor(res, error, mensagem) {
  console.error(error);
  if (ehBancoDesatualizado(error)) {
    return res.status(500).json({ error: MENSAGEM_BANCO_DESATUALIZADO });
  }
  return res.status(500).json({ error: mensagem });
}


// VERIFICAÇÃO DE ERROS

//FUNÇÃO QUE REGISTRA O USUÁRIO
async function register(req, res)  {
  // Cadastro público DESATIVADO.
  //
  // Esta função criava contas sempre com role: 'user' — mas esse valor
  // não existe mais no enum Role (agora é admin/coordenador/professor/
  // aluno), então essa rota quebrava com erro 500 a cada chamada.
  //
  // Além do bug, faz sentido esse endpoint deixar de existir de verdade:
  // com a hierarquia admin -> coordenador -> professor -> aluno, toda
  // conta precisa nascer com um papel explícito, escolhido por alguém
  // já autenticado e acima na hierarquia (rota protegida /users) — não
  // faz mais sentido alguém se cadastrar sozinho, sem dono, pela tela
  // pública (que, inclusive, já foi removida do app).
  return res.status(410).json({
    error: 'Cadastro público desativado. Peça para um administrador ou coordenador criar sua conta.',
  });
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

    // Conta desativada: só avisa DEPOIS de a senha estar certa, para não
    // revelar a quem erra a senha quais contas existem ou estão desativadas.
    // Só barra quem foi desativado DE PROPÓSITO (ativo === false). Se o campo
    // vier vazio (banco sem a migration, Prisma Client desatualizado), a conta
    // não é tratada como desativada — senão todo mundo ficaria trancado de fora.
    if (user.ativo === false) {
      return res.status(403).json({
        error: 'Sua conta está desativada. Procure a coordenação para reativá-la.',
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _senha, tokensValidosDesde: _tokens, ...userWithoutPassword } = user;

    return res.json({ user: userWithoutPassword, token });
  } catch (error) {
    return erroServidor(res, error, 'Erro ao fazer login.');
  }
}

// ---------------------------------------------------------------
// PERFIL (qualquer usuário logado, sobre a PRÓPRIA conta)
// ---------------------------------------------------------------

// PATCH /auth/me  { name }
async function updateProfile(req, res) {
  try {
    // tira espaços das pontas e repetidos no meio ("  Ana   Lima " -> "Ana Lima")
    const name =
      typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';

    if (name.length < NOME_MINIMO) {
      return res.status(400).json({ error: `Informe o seu nome (pelo menos ${NOME_MINIMO} letras).` });
    }
    if (name.length > NOME_MAXIMO) {
      return res.status(400).json({ error: `O nome pode ter no máximo ${NOME_MAXIMO} caracteres.` });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name },
      select: PERFIL,
    });

    return res.json({ user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
    }
    return erroServidor(res, error, 'Erro ao atualizar o perfil.');
  }
}

// PATCH /auth/me/senha  { senhaAtual, password }
// Exige a senha atual (um login esquecido aberto não basta para trocá-la).
// Depois da troca, TODOS os logins antigos da conta deixam de valer
// (tokensValidosDesde) — inclusive o atual: o app leva a pessoa ao login.
async function changeOwnPassword(req, res) {
  try {
    const { senhaAtual, password } = req.body || {};

    if (typeof senhaAtual !== 'string' || !senhaAtual) {
      return res.status(400).json({ error: 'Informe a sua senha atual.' });
    }
    if (typeof password !== 'string' || password.length < SENHA_MINIMA) {
      return res
        .status(400)
        .json({ error: `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` });
    }
    if (password.length > SENHA_MAXIMA) {
      return res
        .status(400)
        .json({ error: `A nova senha pode ter no máximo ${SENHA_MAXIMA} caracteres.` });
    }
    if (password === senhaAtual) {
      return res.status(400).json({ error: 'A nova senha precisa ser diferente da atual.' });
    }

    const atual = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, password: true },
    });
    if (!atual) {
      return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
    }

    if (!(await bcrypt.compare(senhaAtual, atual.password))) {
      return res.status(400).json({ error: 'A senha atual está incorreta.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword, tokensValidosDesde: new Date() },
    });

    return res.json({ ok: true });
  } catch (error) {
    return erroServidor(res, error, 'Erro ao alterar a senha.');
  }
}

module.exports = { register, login, updateProfile, changeOwnPassword };
