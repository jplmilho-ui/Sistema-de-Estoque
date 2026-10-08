/*
  Novo tipo de movimentação: "devolucao".

  Quando um uniforme emprestado é devolvido, o estoque volta a subir (como
  numa entrada), mas a Movimentação agora é registrada como "devolucao" pra
  aparecer separada das entradas normais na tela de Movimentações.

  As devoluções feitas ANTES desta migration continuam como "entrada":
  não há como ligar com segurança uma Movimentacao antiga ao Emprestimo
  que a gerou.
*/

-- AlterEnum
ALTER TYPE "TipoMovimentacao" ADD VALUE 'devolucao';
