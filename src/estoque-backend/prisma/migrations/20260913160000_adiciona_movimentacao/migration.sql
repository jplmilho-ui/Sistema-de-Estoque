/*
  Esta migration estava faltando: o model `Movimentacao` já existia em
  schema.prisma (e o código do backend já usava `prisma.movimentacao`),
  mas a tabela nunca chegou a ser criada no banco. Isso fazia a rota
  GET /movimentacoes (e o registro de entrada/saída em /materiais/:id/retirar
  e /materiais/:id/devolver) falhar com erro 500 ("relation Movimentacao
  does not exist"), que é o erro "Erro ao buscar movimentações" visto no app.
*/

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('entrada', 'saida');

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "responsavelId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
-- ON DELETE RESTRICT: impede excluir um Material que já tem movimentações
-- (o material.controller.js trata esse erro e orienta a inativar em vez
-- de excluir, preservando o histórico).
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- ON DELETE RESTRICT: impede excluir um usuário que já registrou
-- movimentações (preserva quem fez cada entrada/saída no histórico).
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
