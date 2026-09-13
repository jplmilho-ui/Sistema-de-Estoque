// Conexão do Prisma com o PostgreSQL
require('dotenv/config');

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL.replace(
    /([?&])sslmode=require(&|$)/,
    '$1'
  ),
  ssl: {
    rejectUnauthorized: false,
  },
});

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;