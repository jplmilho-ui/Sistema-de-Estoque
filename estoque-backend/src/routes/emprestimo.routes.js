const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');
const {
  listMateriaisDisponiveis,
  criarEmprestimo,
  listMeusEmprestimos,
  cancelarEmprestimo,
  listEmprestimos,
  aprovarEmprestimo,
  recusarEmprestimo,
  devolverEmprestimo,
} = require('../controllers/emprestimo.controller');

const router = express.Router();

router.use(authMiddleware);

const soAluno = allowRoles('aluno');
const equipe = allowRoles('admin', 'coordenador', 'professor');

// ----- Aluno -----
// Uniformes que ele pode pegar emprestado (ativos, com estoque).
router.get('/materiais-disponiveis', soAluno, listMateriaisDisponiveis);
// Empréstimos do próprio aluno (em aberto + histórico).
router.get('/minhas', soAluno, listMeusEmprestimos);
// Pede um uniforme emprestado. O pedido fica PENDENTE: o estoque só é
// baixado quando um professor/coordenador/admin confirma.
router.post('/', soAluno, criarEmprestimo);
// Desiste de um pedido que ainda está pendente.
router.patch('/:id/cancelar', soAluno, cancelarEmprestimo);

// ----- Admin, coordenador e professor -----
// Pendentes + em aberto (inclui atrasados) + devolvidos recentemente.
router.get('/', equipe, listEmprestimos);
// Confirmar o pedido baixa o estoque e registra a saída em Movimentações.
router.post('/:id/aprovar', equipe, aprovarEmprestimo);
router.post('/:id/recusar', equipe, recusarEmprestimo);
// Registra a devolução: o uniforme volta ao estoque.
router.post('/:id/devolver', equipe, devolverEmprestimo);

module.exports = router;
