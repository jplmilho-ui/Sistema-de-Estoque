
// CONTROLE DE AUTENTICAÇÃO DO BACKEND

// importacação de bibliotecas
const bcrypt = require('bcryptjs'); //Criptografia de senhas
const jwt = require('jsonwebtoken'); // TOKEN PARA LOGAR AO SISTEMA 
const prisma = require('../lib/prisma'); //Conexão com o Prisma que permite o Node.js conversar com o Postgre

const SENHA_MINIMA = 8;


// VERIFICAÇÃO DE ERROS

//FUNÇÃO QUE REGISTRA O USUÁRIO
async function register(req, res)  {
  // Cadastro público DESATIVADO.
  //
  // Esta função criava contas sempre com role: 'user' — mas esse valor
  // não existe mais no enum Role (agora é super_admin/admin/professor/
  // aluno), então essa rota quebrava com erro 500 a cada chamada.
  //
  // Além do bug, faz sentido esse endpoint deixar de existir de verdade:
  // com a hierarquia super_admin -> admin -> professor -> aluno, toda
  // conta precisa nascer com um papel explícito, escolhido por alguém
  // já autenticado e acima na hierarquia (rota protegida /users) — não
  // faz mais sentido alguém se cadastrar sozinho, sem dono, pela tela
  // pública (que, inclusive, já foi removida do app).
  return res.status(410).json({
    error: 'Cadastro público desativado. Peça para um administrador criar sua conta.',
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
