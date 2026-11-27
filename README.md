<div align="center">

<img src="design/assets/logo_sece.png" alt="Logo do SECE" width="160">

# SECE
### Sistema web para o controle de estoque do curso de Enfermagem

![Status](https://img.shields.io/badge/status-concluído-brightgreen)
![React](https://img.shields.io/badge/React-[versão]-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-[versão]-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-[versão]-4169E1?logo=postgresql&logoColor=white)

</div>

---

## 📋 Descrição

O **SECE** é um sistema web desenvolvido como Trabalho de Conclusão de Curso (TCC) para melhorar o controle e a organização dos materiais do curso técnico de Enfermagem da ETEC de Campo Limpo Paulista.

Antes do sistema, o controle de estoque era feito de forma manual, o que dificultava saber quais itens estavam disponíveis, quem os retirou e quando. O SECE resolve esse problema centralizando o estoque em um só lugar, com registro de movimentações, empréstimos de uniformes e solicitações de EPI, cada um com acesso de acordo com o perfil do usuário.

**Perfis de usuário:**

| Perfil | O que faz |
|---|---|
| **Aluno** | Solicita uniformes e EPIs, acompanha pedidos e baixa o termo de empréstimo em PDF |
| **Professor** | Consulta o estoque e retira itens para as aulas |
| **Coordenador** | Gerencia o estoque e confirma ou recusa empréstimos |
| **Administrador** | Adiciona itens, gerencia usuários e coordenadores |

---

## 👥 Equipe

- **Alyffer Santos Moleiro** — [Função: Front-end e Identidade Visual]
- **João Paulo Lourencinho Milho** — [Função: Back-end e Front-end]
- **Matheus Lima Santos** — [Função: Artigo]

---

## 🛠️ Tecnologias Utilizadas

**Front-end**
- React [2.2.0]
- TypeScript [6.0.3]
- HTML5 e CSS3

**Back-end**
- Node.js [6.9.0]
- Express [5.3.0]
- Prisma ORM [8]

**Banco de dados**
- PostgreSQL [18.6.1]


---

## 🖼️ Imagens do sistema

### Tela de login
![Tela de login](docs/img/login.png)

### Tela inicial
![Tela inicial](docs/img/home.png)

### Tela de estoque (funcionalidade principal)
![Tela de estoque](docs/img/estoque.png)

---

## 🚀 Como executar o projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) 
- [PostgreSQL](https://www.postgresql.org/) 
- [Git](https://git-scm.com/)

### Passo a passo

**1. Clone o repositório**
```bash
git clone https://github.com/Matheus1300/[nome-do-repositorio].git
cd [nome-do-repositorio]
```

**2. Crie o banco de dados**

No PostgreSQL, crie um banco vazio (por exemplo, `sece`). Os scripts SQL e os modelos de dados estão na pasta [`/database`](./database).

**3. Configure as variáveis de ambiente**

Dentro da pasta do back-end, crie um arquivo `.env` com:
```env
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/sece"
PORT=3000
JWT_SECRET="[uma-chave-secreta]"
```

**4. Instale as dependências e rode as migrações do Prisma**
```bash
cd src/estoque-backend
npm install
npx prisma migrate dev
npm run dev
```

**5. Em outro terminal, execute o front-end**
```bash
# na raiz do projeto
npm install
npm start
```

**6. Acesse o sistema**

Abra [http://localhost:[porta]](http://localhost:[porta]) no navegador.

---

## 📁 Estrutura do repositório

```
├── docs/        → Documentação do TCC (questionário, fichamento etc.)
├── src/         → Código-fonte do sistema
├── design/      → Protótipos e interfaces (casos de uso, DER, identidade visual, telas)
├── database/    → Scripts SQL e modelos de dados
└── README.md    → Apresentação do projeto
```

---

## 📚 Como citar o projeto

MOLEIRO, Alyffer Santos; MILHO, João Paulo Lourencinho; SANTOS, Matheus Lima. **Desenvolvimento de um sistema web para o controle de estoque do curso de Enfermagem na ETEC de Campo Limpo Paulista**. 2026. 

---

## 📬 Contato

Em caso de dúvidas, entre em contato com [jplmilho@gmail.com](mailto:jplmilho@gmail.com) ou com [matheuslima4025@gmail.com](mailto:matheuslima4025@gmail.com).

📄 Para acessar o trabalho escrito do projeto: https://ric.cps.sp.gov.br/
