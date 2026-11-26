const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const {
  listUsers,
  createUser,
  deleteUser,
  setUserActive,
  resetUserPassword,
} = require('../controllers/users.controller');

const router = express.Router();

// Toda rota aqui embaixo exige: 1) estar logado, 2) ser admin.
router.use(authMiddleware, adminMiddleware);

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id/ativo', setUserActive);
router.patch('/:id/senha', resetUserPassword);
router.delete('/:id', deleteUser);

module.exports = router;
