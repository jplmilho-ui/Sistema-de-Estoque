/*
  Parte 2/2: dados da resposta ao pedido de empréstimo e novo status padrão.

  Os empréstimos que já existem (emprestado/devolvido) não mudam: eles
  foram feitos no fluxo antigo, sem confirmação, e continuam valendo.
*/

-- AlterTable
ALTER TABLE "Emprestimo" ALTER COLUMN "status" SET DEFAULT 'pendente';

-- AlterTable
ALTER TABLE "Emprestimo" ADD COLUMN "motivoRecusa" TEXT,
ADD COLUMN "respondidoPorId" INTEGER,
ADD COLUMN "respondidoEm" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
