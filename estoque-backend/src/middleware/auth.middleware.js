const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { ehBancoDesatualizado, MENSAGEM_BANCO_DESATUALIZADO } = require('../lib/erros');

// Use esse middleware em qualquer rota que só usuários logados podem acessar.
// Exemplo:
//   router.get('/produtos', authMiddleware, listarProdutos);
//
// Além de validar o token, confere NO BANCO (a cada requisição) se a conta
// ainda pode usar o sistema:
//   - a conta existe;
//   - não foi desativada;
//   - o token não é anterior a uma redefinição de senha / desativação
//     (tokensValidosDesde) — assim sessões antigas caem na hora.
// O usuário carregado fica em req.user, e os middlewares de papel
// (role.middleware.js / admin.middleware.js) reaproveitam em vez de
// consultar o banco de novo.
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  const [, token] = authHeader.split(' '); // formato esperado: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Token mal formatado.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }

  try {
    // select: não precisa (nem deve) trazer o hash da senha aqui.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, ativo: true, tokensValidosDesde: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
    }

    // Só barra quem foi desativado de propósito (ver auth.controller.js).
    if (user.ativo === false) {
      return res
        .status(401)
        .json({ error: 'Sua conta está desativada. Procure a coordenação.' });
    }

    // "iat" (quando o token foi emitido) é em segundos.
    if (
      user.tokensValidosDesde &&
      decoded.iat < Math.floor(user.tokensValidosDesde.getTime() / 1000)
    ) {
      return res
        .status(401)
        .json({ error: 'Sua sessão foi encerrada. Entre novamente.' });
    }

    req.userId = user.id;
    req.user = user;
    return next();
  } catch (error) {
    // Aqui o erro quase sempre quer dizer "Prisma Client desatualizado" ou
    // "migration não aplicada" (o schema ganhou ativo/tokensValidosDesde).
    // Falha de propósito, em vez de ignorar a checagem: sem ela uma conta
    // desativada continuaria entrando.
    if (ehBancoDesatualizado(error)) {
      console.error(MENSAGEM_BANCO_DESATUALIZADO);
      console.error(error);
      return res.status(500).json({ error: MENSAGEM_BANCO_DESATUALIZADO });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao verificar a sessão.' });
  }
}

module.exports = authMiddleware;
