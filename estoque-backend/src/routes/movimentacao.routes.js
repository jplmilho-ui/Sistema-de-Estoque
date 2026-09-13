const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { listMovimentacoes } = require('../controllers/movimentacao.controller');

const router = express.Router();

// Qualquer pessoa logada pode consultar o histórico (RF004).
router.use(authMiddleware);
router.get('/', listMovimentacoes);

module.exports = router;
