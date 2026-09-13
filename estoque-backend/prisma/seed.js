// estoque-backend/prisma/seed.js
require('dotenv/config');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

async function main() {
  const email = 'primeiro1@etec.com'; // troque aqui
  const senha = '12345678';   // troque por uma senha forte

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    console.log('Já existe um usuário com esse e-mail.');
    return;
  }

  const hashedPassword = await bcrypt.hash(senha, 10);

  const superAdmin = await prisma.user.create({
    data: { name: 'Super Admin', email, password: hashedPassword, role: 'super_admin' },
  });

  console.log('Super admin criado:', superAdmin.email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });