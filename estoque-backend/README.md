# Backend do sistema de estoque

API em Node.js + Express + Prisma + PostgreSQL

## 1. Instalar as dependências

Dentro da pasta `estoque-backend`, rode:

```
npm install
```

## 2. Configurar a conexão com o banco

1. Copie o arquivo `.env.example` e renomeie a cópia para `.env`.
2. Abra o `.env` e troque `USUARIO`, `SENHA` e `NOME_DO_BANCO` pelos dados do
   seu PostgreSQL local (os mesmos que você usa para abrir o pgAdmin ou
   psql). Se você ainda não tem um banco criado especificamente para esse
   projeto, crie um (pode chamar de `estoque`, por exemplo) antes de seguir.
3. Troque também o `JWT_SECRET` por qualquer string longa e aleatória.

## 3. Criar a tabela de usuários no banco

Esse comando lê o `prisma/schema.prisma`, cria a tabela `User` no seu
PostgreSQL e gera o Prisma Client (o "tradutor" que o código usa para
falar com o banco):

```
npx prisma migrate dev --name init
```

Se der tudo certo, você verá uma mensagem confirmando a migration e pode
abrir `npx prisma studio` para ver a tabela `User` vazia no navegador.

## 4. Rodar o servidor

```
npm run dev
```

Se aparecer `Servidor rodando em http://localhost:3333`, está funcionando.
Abra esse endereço no navegador — deve aparecer um JSON com `"status": "ok"`.

## 5. Testar o cadastro e o login

Com o servidor rodando, teste com o `curl` (ou Insomnia/Postman/Thunder Client):

```
curl -X POST http://localhost:3333/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria","email":"[email protected]","password":"123456"}'
```

```
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"[email protected]","password":"123456"}'
```

O login deve devolver um `token`. É esse token que o React vai guardar e
enviar nas próximas requisições para provar que o usuário está logado.

## 6. Conectar com o React

Veja `frontend-integration/authApi.js` — copie esse arquivo para dentro do
seu projeto React (ex: `src/services/authApi.js`) e importe as funções
`registerUser` e `loginUser` nas suas telas de cadastro e login.

## Erros comuns

- **"Can't reach database server"**: o PostgreSQL não está rodando, ou os
  dados no `DATABASE_URL` (usuário/senha/porta/nome do banco) estão errados.
- **"password authentication failed"**: usuário ou senha errados no
  `DATABASE_URL`.
- **CORS bloqueando o React**: confira se a porta do seu `npm start` do
  React (normalmente 3000 ou 5173) está diferente da porta do backend
  (3333) — isso é normal, o `cors()` no `server.js` já libera isso.

## Quantidades: unidades x embalagens

O estoque é guardado **sempre em unidades** (`Material.quantidadeTotal`). A
embalagem (caixa, pacote...) é só uma forma de digitar e exibir:
`fatorConversao` = quantas unidades cabem em 1 embalagem.

- A API devolve, junto com cada material: `quantidadeTotal` (unidades),
  `quantidade` (embalagens **fechadas**), `unidadesAvulsas` (as unidades soltas, fora de uma embalagem fechada) e `quantidadeTexto`
  (ex.: `"3 caixas e 12 un. (162 un.)"`).
- `Movimentacao`, `Solicitacao` e `Emprestimo` guardam a quantidade em unidades.
- Retirar, adicionar, solicitar e emprestar aceitam `{ quantidade, unidade }`:
  `unidade: "embalagem"` (padrão, igual ao comportamento antigo) ou
  `unidade: "unidade"` (por unidade, sem levar a caixa toda). Ex.: retirar 1 unidade de um item em caixa →
  `POST /materiais/:id/retirar { "quantidade": 1, "unidade": "unidade" }`.
- `Material.permiteFracionar` (padrão `true`): se `false`, o **aluno** só pode
  pedir embalagem fechada (material estéril, kits). A equipe sempre pode
  movimentar por unidade.
- Editar um material (`PUT /materiais/:id`) **não altera o saldo**: o estoque
  muda só por retirar/adicionar (que registram a movimentação). O saldo inicial
  é informado só no cadastro.
- `estoqueMinimo` continua em embalagens; o alerta compara
  `quantidadeTotal <= estoqueMinimo * fatorConversao`.

### Migration `20261011120000_estoque_em_unidades`

Converte os dados existentes (registros antigos em embalagens são multiplicados
pelo fator **atual** do material) e **remove a coluna `Material.quantidade`**.
Faça backup antes e aplique com `npx prisma migrate deploy`.

## Contas: perfil, redefinir senha e sessões

- **Perfil (qualquer usuário logado, na própria conta)** — ícone de pessoa na
  barra superior do app:
  - `PATCH /auth/me` `{ "name": "..." }` troca o nome.
  - `PATCH /auth/me/senha` `{ "senhaAtual": "...", "password": "..." }` troca a
    senha; **exige a senha atual**. Depois disso os logins antigos da conta
    (inclusive o atual) deixam de valer e o app leva a pessoa ao login.
- **Redefinir a senha de outra pessoa** — `PATCH /users/:id/senha`
  `{ "password": "..." }`: admin redefine a de qualquer um; coordenador, a de
  professor e aluno. A própria senha não se troca por essa rota (vai pelo
  perfil).
- `User.tokensValidosDesde`: logins emitidos **antes** dessa data deixam de
  valer. É preenchido ao trocar/redefinir a senha (e ao desativar/reativar).
- `User.ativo` + `PATCH /users/:id/ativo` `{ "ativo": true|false }`: o backend
  ainda suporta desativar/reativar uma conta (conta desativada não entra nem
  continua logada; o histórico é preservado), mas **o app não tem mais botão
  para isso**.
- Login de conta desativada responde 403 **só depois** de a senha estar certa
  (não revela quais contas existem a quem erra a senha).
- O `authMiddleware` carrega o usuário uma única vez (`req.user`) e os
  middlewares de papel reaproveitam, então cada requisição faz 1 consulta de
  usuário (antes eram 2).

## Datas e horários

O servidor roda em UTC, então tudo que depende de fuso usa `src/lib/datas.js`
(`America/Sao_Paulo`): `formatDataHoraBR` (horário das movimentações) e
`hojeBrasil` (usado no resumo do estoque e nos empréstimos). As movimentações
também devolvem `dataISO` (o instante exato) para o app calcular "há 5 min"
certo em qualquer fuso.

### Se aparecer "Sua conta está desativada" sem ninguém ter desativado

Confira, no servidor, se o Prisma Client e o banco estão em dia com o schema:

```
npx prisma generate          # regenera o cliente (e reinicie o servidor)
npx prisma migrate deploy    # aplica as migrations pendentes
```

Para ver o estado das contas direto no banco:
`SELECT id, email, ativo FROM "User";` — e, se alguma estiver `false` sem
querer: `UPDATE "User" SET "ativo" = true WHERE email = 'fulano@escola.com';`

### Migration `20261012120000_usuario_ativo_e_sessoes`

Adiciona `User.ativo` (todas as contas existentes continuam ativas) e
`User.tokensValidosDesde`. Aplique com `npx prisma migrate deploy`.
