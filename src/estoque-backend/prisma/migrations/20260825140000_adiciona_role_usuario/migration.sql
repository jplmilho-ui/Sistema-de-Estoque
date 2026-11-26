-- AlterTable
-- Todo mundo que já existe no banco vira "user" por padrão.
-- Depois de rodar essa migration, promova a sua própria conta pra "admin"
-- pelo Prisma Studio (npx prisma studio) ou por SQL, veja o README.
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
