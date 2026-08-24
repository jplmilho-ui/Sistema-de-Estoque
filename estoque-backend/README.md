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
