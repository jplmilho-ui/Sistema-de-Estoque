const prisma = require('../lib/prisma');

// Libera as rotas de gerenciamento de usuários para Admin e Coordenador.
// Use sempre DEPOIS do authMiddleware (que já valida o token, confere que a
// conta está ativa e deixa o usuário em req.user).
// O papel vem do banco (não do token), pra garantir que, se alguém perder
// esse nível de acesso, o bloqueio é imediato.
async function adminMiddleware(req, res, next) {
  try {
    const user =
      req.user ||
      (await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, role: true, ativo: true },
      }));

    // admin está acima do coordenador na hierarquia, então os dois
    // passam por aqui.
    if (!user || user.ativo === false || !['admin', 'coordenador'].includes(user.role)) {
      return res.status(403).json({ error: 'Acesso restrito a administradores e coordenadores.' });
    }

    req.userRole = user.role;
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao verificar permissões.' });
  }
}

module.exports = adminMiddleware;
