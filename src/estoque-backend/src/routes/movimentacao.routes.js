const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');
const { listMovimentacoes } = require('../controllers/movimentacao.controller');

const router = express.Router();

// O histórico (RF004) é consultado por admin, coordenador e professor.
// O aluno só tem acesso à tela de Solicitações.
router.use(authMiddleware);
router.get('/', allowRoles('admin', 'coordenador', 'professor'), listMovimentacoes);

module.exports = router;
