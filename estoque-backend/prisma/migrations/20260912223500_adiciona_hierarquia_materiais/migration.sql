/*
  Warnings:

  - A unique constraint covering the columns `[rm]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `role` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'professor', 'aluno');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "criadoPorId" INTEGER,
ADD COLUMN     "rm" TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL;

-- CreateTable
CREATE TABLE "Material" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidadeMedida" TEXT NOT NULL,
    "fatorConversao" INTEGER NOT NULL DEFAULT 1,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "quantidadeTotal" INTEGER NOT NULL DEFAULT 0,
    "validade" DATE,
    "ca" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_rm_key" ON "User"("rm");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
