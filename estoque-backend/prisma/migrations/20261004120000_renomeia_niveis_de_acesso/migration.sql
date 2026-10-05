/*
  Renomeia os níveis de acesso:
    "Admin"       (admin)       -> "Coordenador" (coordenador)
    "Super Admin" (super_admin) -> "Admin"       (admin)

  ATENÇÃO À ORDEM: o valor "admin" antigo precisa ser renomeado ANTES,
  para liberar o nome "admin" para o antigo "super_admin".

  RENAME VALUE mantém todos os usuários já cadastrados: quem era admin
  passa a ser coordenador e quem era super_admin passa a ser admin,
  sem perder nenhum dado.
*/
ALTER TYPE "Role" RENAME VALUE 'admin' TO 'coordenador';
ALTER TYPE "Role" RENAME VALUE 'super_admin' TO 'admin';
