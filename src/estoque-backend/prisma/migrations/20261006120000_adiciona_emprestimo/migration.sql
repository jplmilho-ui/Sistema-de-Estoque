/*
  Empréstimos de uniforme feitos pelo aluno (com data de devolução).

  Tabela nova: nenhum dado existente é alterado.
*/

-- CreateEnum
CREATE TYPE "StatusEmprestimo" AS ENUM ('emprestado', 'devolvido');

-- CreateTable
CREATE TABLE "Emprestimo" (
    "id" SERIAL NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "observacao" TEXT,
    "status" "StatusEmprestimo" NOT NULL DEFAULT 'emprestado',
    "dataDevolucaoPrevista" DATE NOT NULL,
    "devolvidoEm" TIMESTAMP(3),
    "recebidoPorId" INTEGER,
    "alunoId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emprestimo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Emprestimo_alunoId_idx" ON "Emprestimo"("alunoId");

-- CreateIndex
CREATE INDEX "Emprestimo_status_dataDevolucaoPrevista_idx" ON "Emprestimo"("status", "dataDevolucaoPrevista");

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_recebidoPorId_fkey" FOREIGN KEY ("recebidoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
