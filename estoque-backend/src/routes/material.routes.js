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

// Ver a lista: super_admin, admin (coordenador) e professor — os três
// precisam enxergar os materiais (a tela de Materiais é só pra
// super_admin/admin; professor só usa esses dados pela tela de Estoque,
// que reaproveita esse mesmo endpoint com ?ativo=true).
router.get('/', allowRoles('super_admin', 'admin', 'professor'), listMaterials);

// Resumo pra Tela Inicial (Produtos Cadastrados / Divergências / Itens
// Auditados). Sem restrição de papel — qualquer pessoa logada que caia
// na Tela Inicial precisa desses números, e nenhum dado sensível é
// exposto aqui (só contagens).
router.get('/resumo', resumo);

// Cadastrar, editar, ativar/inativar e excluir: super_admin e admin
// (coordenador). Professor NÃO administra o cadastro de materiais.
router.post('/', allowRoles('super_admin', 'admin'), createMaterial);
router.put('/:id', allowRoles('super_admin', 'admin'), updateMaterial);
router.patch('/:id/ativo', allowRoles('super_admin', 'admin'), setMaterialActive);
router.delete('/:id', allowRoles('super_admin', 'admin'), deleteMaterial);

// Retirar / adicionar quantidade (tela de Estoque): super_admin, admin
// e professor podem movimentar o estoque, mesmo sem poder administrar
// os tipos de materiais.
router.post('/:id/retirar', allowRoles('super_admin', 'admin', 'professor'), retirar);
router.post('/:id/devolver', allowRoles('super_admin', 'admin', 'professor'), devolver);

module.exports = router;
