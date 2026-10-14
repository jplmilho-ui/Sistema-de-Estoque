// Erro "esperado" (regra de negócio) com o status HTTP que deve voltar.
// Antes havia uma cópia desta classe em cada controller.
class ErroNegocio extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// O schema do Prisma ganhou campos/tabelas, mas o Prisma Client não foi
// regenerado ou a migration não foi aplicada no banco. Reconhece os erros
// típicos disso para avisar com uma mensagem útil (e não um "erro genérico").
function ehBancoDesatualizado(error) {
  return (
    error?.name === 'PrismaClientValidationError' || // cliente antigo: "Unknown field ..."
    error?.code === 'P2022' || // coluna não existe no banco
    error?.code === 'P2021' || // tabela não existe no banco
    /Unknown field|Unknown argument|column .* does not exist/i.test(String(error?.message))
  );
}

const MENSAGEM_BANCO_DESATUALIZADO =
  'O servidor está com o banco de dados ou o Prisma desatualizado. ' +
  'No backend, rode "npx prisma migrate deploy" e "npx prisma generate" e reinicie o servidor.';

module.exports = { ErroNegocio, ehBancoDesatualizado, MENSAGEM_BANCO_DESATUALIZADO };
