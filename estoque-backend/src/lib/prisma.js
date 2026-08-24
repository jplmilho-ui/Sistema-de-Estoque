const { PrismaClient } = require('@prisma/client');

// Mantemos uma única instância do Prisma Client em todo o projeto
// e importamos ela nos controllers, em vez de criar uma nova a cada arquivo.
const prisma = new PrismaClient();

module.exports = prisma;
