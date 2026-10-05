const prisma = require('../lib/prisma');

// Libera as rotas de gerenciamento de usuários para Admin e Coordenador.
// Use sempre DEPOIS do authMiddleware (que já preenche req.userId).
// Consulta o banco de novo (em vez de confiar só no token) pra garantir
// que, se alguém perder esse nível de acesso, o bloqueio é imediato.
async function adminMiddleware(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    // admin está acima do coordenador na hierarquia, então os dois
    // passam por aqui.
    if (!user || !['admin', 'coordenador'].includes(user.role)) {
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
