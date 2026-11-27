const prisma = require('../lib/prisma');

// Middleware genérico pra rotas que podem ser acessadas por mais de um
// papel (ex: retirar material pode ser admin, coordenador OU professor).
//
// Use sempre DEPOIS do authMiddleware, que já valida o token, confere que
// a conta está ativa e deixa o usuário em req.user. O papel vem do BANCO
// (não do token), então se alguém perder o nível de acesso o corte é
// imediato. Se por algum motivo req.user não existir, consulta o banco.
//
// Exemplo de uso:
//   router.post('/:id/retirar', allowRoles('admin', 'coordenador', 'professor'), retirar);
function allowRoles(...roles) {
  return async function roleMiddleware(req, res, next) {
    try {
      const user =
        req.user ||
        (await prisma.user.findUnique({
          where: { id: req.userId },
          select: { id: true, role: true, ativo: true },
        }));

      if (!user || user.ativo === false || !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Você não tem permissão para fazer isso.' });
      }

      // Deixa o papel já carregado disponível pro controller.
      req.userRole = user.role;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao verificar permissões.' });
    }
  };
}

module.exports = allowRoles;
