/*
  Empréstimo de uniforme agora precisa de confirmação de um professor,
  coordenador ou admin antes de o aluno receber o uniforme.

  Parte 1/2: novos status do empréstimo.
    pendente  -> pedido feito, aguardando confirmação
    recusado  -> a equipe recusou o pedido
    cancelado -> o aluno desistiu antes da resposta

  Os valores novos ficam numa migration separada da que os usa (parte 2)
  porque o PostgreSQL não deixa usar um valor de enum na mesma transação
  em que ele foi criado.
*/

-- AlterEnum
ALTER TYPE "StatusEmprestimo" ADD VALUE 'pendente';
ALTER TYPE "StatusEmprestimo" ADD VALUE 'recusado';
ALTER TYPE "StatusEmprestimo" ADD VALUE 'cancelado';
