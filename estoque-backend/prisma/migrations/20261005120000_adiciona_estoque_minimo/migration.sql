/*
  Estoque mínimo por material (usado para o aviso de "Estoque baixo").

  Coluna nova com padrão 0 ("sem alerta"): os materiais já cadastrados
  continuam funcionando como antes, até alguém definir o mínimo deles
  na tela de Materiais.
*/

-- AlterTable
ALTER TABLE "Material" ADD COLUMN "estoqueMinimo" INTEGER NOT NULL DEFAULT 0;
