const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');
const {
  listMateriaisDisponiveis,
  criarSolicitacao,
  listMinhasSolicitacoes,
  cancelarSolicitacao,
  listSolicitacoes,
  aprovarSolicitacao,
  recusarSolicitacao,
} = require('../controllers/solicitacao.controller');

const router = express.Router();

router.use(authMiddleware);

const soAluno = allowRoles('aluno');
const equipe = allowRoles('admin', 'coordenador', 'professor');

// ----- Aluno -----
// Materiais que ele pode pedir (ativos, com estoque, EPI/Uniforme).
router.get('/materiais-disponiveis', soAluno, listMateriaisDisponiveis);
// Pedidos do próprio aluno (pendentes + histórico).
router.get('/minhas', soAluno, listMinhasSolicitacoes);
// Cria um pedido novo.
router.post('/', soAluno, criarSolicitacao);
// Desiste de um pedido que ainda está pendente.
router.patch('/:id/cancelar', soAluno, cancelarSolicitacao);

// ----- Admin, coordenador e professor (via notificações) -----
// Pendentes de todos os alunos + respostas recentes.
router.get('/', equipe, listSolicitacoes);
// Aprovar baixa o estoque e registra a saída em Movimentações.
router.post('/:id/aprovar', equipe, aprovarSolicitacao);
router.post('/:id/recusar', equipe, recusarSolicitacao);

module.exports = router;
