//Ponto de entrada da API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const materialRoutes = require('./routes/material.routes');
const movimentacaoRoutes = require('./routes/movimentacao.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/materiais', materialRoutes);
app.use('/movimentacoes', movimentacaoRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API do sistema de estoque no ar' });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
