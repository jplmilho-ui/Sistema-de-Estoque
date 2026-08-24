const jwt = require('jsonwebtoken');

// Use esse middleware em qualquer rota que só usuários logados podem acessar.
// Exemplo, quando você criar as rotas de produto:
//   router.get('/produtos', authMiddleware, listarProdutos);
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  const [, token] = authHeader.split(' '); // formato esperado: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Token mal formatado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

module.exports = authMiddleware;
