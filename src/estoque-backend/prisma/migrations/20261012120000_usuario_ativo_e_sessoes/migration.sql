/*
  Contas de usuário: desativar e invalidar sessões.

  - "ativo": conta desativada não consegue entrar (nem continuar logada),
    mas o histórico dela (movimentações, aprovações...) é preservado. Resolve
    o caso do professor que sai da escola e não pode ser excluído por já ter
    registros em seu nome.
  - "tokensValidosDesde": tokens (logins) emitidos ANTES dessa data deixam de
    valer. É preenchido quando a senha é redefinida e quando a conta é
    desativada/reativada, para encerrar sessões antigas.

  Todas as contas existentes continuam ativas.
*/
ALTER TABLE "User"
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tokensValidosDesde" TIMESTAMP(3);
