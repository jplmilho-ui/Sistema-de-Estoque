const prisma = require('../lib/prisma');

// Use sempre DEPOIS do authMiddleware (que já preenche req.userId).
// Consulta o banco de novo (em vez de confiar só no token) pra garantir
// que, se alguém deixar de ser admin, o acesso é cortado na hora.
async function adminMiddleware(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    // super_admin está acima do admin na hierarquia, então também
    // passa por aqui — sem isso, o próprio super_admin ficava travado
    // fora das rotas de gerenciamento de usuários.
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }

    req.userRole = user.role;
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao verificar permissões.' });
  }
}

module.exports = adminMiddleware;
