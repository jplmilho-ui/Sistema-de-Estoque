/*
  Solicitações de material feitas pelo aluno.

  Tabela nova: nenhum dado existente é alterado.
*/

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('pendente', 'aprovada', 'recusada', 'cancelada');

-- CreateTable
CREATE TABLE "Solicitacao" (
    "id" SERIAL NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "observacao" TEXT,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'pendente',
    "motivoRecusa" TEXT,
    "alunoId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "respondidoPorId" INTEGER,
    "respondidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Solicitacao_alunoId_idx" ON "Solicitacao"("alunoId");

-- CreateIndex
CREATE INDEX "Solicitacao_status_idx" ON "Solicitacao"("status");

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
