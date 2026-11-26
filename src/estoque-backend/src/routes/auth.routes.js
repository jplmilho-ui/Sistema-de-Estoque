const express = require('express');
const {
  register,
  login,
  updateProfile,
  changeOwnPassword,
} = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// Perfil: qualquer usuário logado, sobre a própria conta.
router.patch('/me', authMiddleware, updateProfile);
router.patch('/me/senha', authMiddleware, changeOwnPassword);

module.exports = router;
