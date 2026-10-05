const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');
const {
  listMaterials,
  createMaterial,
  updateMaterial,
  setMaterialActive,
  deleteMaterial,
  retirar,
  devolver,
  resumo,
} = require('../controllers/material.controller');

const router = express.Router();

// Toda rota de materiais exige estar logado.
router.use(authMiddleware);

// Ver a lista: admin, coordenador e professor — os três
// precisam enxergar os materiais (a tela de Materiais é só pra
// admin/coordenador; professor só usa esses dados pela tela de Estoque,
// que reaproveita esse mesmo endpoint com ?ativo=true).
router.get('/', allowRoles('admin', 'coordenador', 'professor'), listMaterials);

// Resumo pra Tela Inicial (Produtos Cadastrados / Divergências / Itens
// Auditados). Só quem usa a Tela Inicial (admin, coordenador e professor)
// — o aluno só acessa a tela de Solicitações.
router.get('/resumo', allowRoles('admin', 'coordenador', 'professor'), resumo);

// Cadastrar, editar, ativar/inativar e excluir: admin e coordenador.
// Professor NÃO administra o cadastro de materiais.
router.post('/', allowRoles('admin', 'coordenador'), createMaterial);
router.put('/:id', allowRoles('admin', 'coordenador'), updateMaterial);
router.patch('/:id/ativo', allowRoles('admin', 'coordenador'), setMaterialActive);
router.delete('/:id', allowRoles('admin', 'coordenador'), deleteMaterial);

// Retirar / adicionar quantidade (tela de Estoque): admin, coordenador
// e professor podem movimentar o estoque, mesmo sem poder administrar
// os tipos de materiais.
router.post('/:id/retirar', allowRoles('admin', 'coordenador', 'professor'), retirar);
router.post('/:id/devolver', allowRoles('admin', 'coordenador', 'professor'), devolver);

module.exports = router;
