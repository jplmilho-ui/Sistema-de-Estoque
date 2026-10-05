const prisma = require('../lib/prisma');

// Middleware genérico pra rotas que podem ser acessadas por mais de um
// papel (ex: retirar material pode ser admin, coordenador OU professor).
//
// Use sempre DEPOIS do authMiddleware (que já preenche req.userId).
// Assim como o admin.middleware.js, consulta o banco de novo a cada
// requisição (em vez de confiar só no token) pra cortar o acesso na
// hora, caso o papel de alguém mude.
//
// Exemplo de uso:
//   router.post('/:id/retirar', allowRoles('admin', 'coordenador', 'professor'), retirar);
function allowRoles(...roles) {
  return async function roleMiddleware(req, res, next) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });

      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Você não tem permissão para fazer isso.' });
      }

      // Deixa o papel já carregado disponível pro controller,
      // evitando uma segunda consulta ao banco.
      req.userRole = user.role;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao verificar permissões.' });
    }
  };
}

module.exports = allowRoles;
