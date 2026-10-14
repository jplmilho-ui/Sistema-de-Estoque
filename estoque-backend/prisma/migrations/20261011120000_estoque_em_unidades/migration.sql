/*
  Estoque passa a ser guardado em UNIDADES.

  Problema: um material cadastrado como "Caixa" (ex: 50 un.) só aceitava
  quantidades em caixas inteiras. Não dava para retirar 1 unidade, nem o
  aluno pedir 1 unidade, e uma caixa aberta não existia no sistema.

  Agora:
    - Material.quantidadeTotal (unidades) é a fonte da verdade;
    - Material.quantidade (embalagens) deixa de existir no banco — a API
      calcula "caixas fechadas + unidades avulsas" a partir do total;
    - Movimentacao, Solicitacao e Emprestimo guardam a quantidade em UNIDADES;
    - Material.permiteFracionar diz se o aluno pode pedir unidade avulsa
      de um item que vem em embalagem (padrão: sim).

  Dados existentes:
    - Os registros antigos estavam em embalagens; são multiplicados pelo
      fator de conversão ATUAL do material. Se o fator já foi corrigido
      alguma vez, o histórico antigo pode ficar impreciso (não há como
      saber qual fator valia na época).
    - quantidadeTotal é recalculado a partir da quantidade antiga, que era
      quem de fato controlava o saldo.

  ATENÇÃO: a coluna "quantidade" de Material é removida (DROP COLUMN).
  Faça um backup antes de aplicar em produção.
*/

-- 1) Nova coluna
ALTER TABLE "Material" ADD COLUMN "permiteFracionar" BOOLEAN NOT NULL DEFAULT true;

-- 2) Histórico e pedidos: embalagens -> unidades
UPDATE "Movimentacao" AS mv
   SET "quantidade" = mv."quantidade" * m."fatorConversao"
  FROM "Material" AS m
 WHERE m."id" = mv."materialId";

UPDATE "Solicitacao" AS s
   SET "quantidade" = s."quantidade" * m."fatorConversao"
  FROM "Material" AS m
 WHERE m."id" = s."materialId";

UPDATE "Emprestimo" AS e
   SET "quantidade" = e."quantidade" * m."fatorConversao"
  FROM "Material" AS m
 WHERE m."id" = e."materialId";

-- 3) Saldo: o total em unidades passa a ser a fonte da verdade
UPDATE "Material" SET "quantidadeTotal" = "quantidade" * "fatorConversao";

-- 4) A coluna antiga não é mais usada
ALTER TABLE "Material" DROP COLUMN "quantidade";
