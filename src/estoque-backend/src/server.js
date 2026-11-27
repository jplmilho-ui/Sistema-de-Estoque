// Ponto de entrada da API
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const materialRoutes = require('./routes/material.routes');
const movimentacaoRoutes = require('./routes/movimentacao.routes');
const solicitacaoRoutes = require('./routes/solicitacao.routes');
const emprestimoRoutes = require('./routes/emprestimo.routes');

const app = express();

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors());

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/materiais', materialRoutes);
app.use('/movimentacoes', movimentacaoRoutes);
app.use('/solicitacoes', solicitacaoRoutes);
app.use('/emprestimos', emprestimoRoutes);

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API do sistema de estoque no ar'
  });
});

const PORT = process.env.PORT || 3333;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 API rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;