ALTER TABLE "business_rules" ADD COLUMN "endereco_empresa_bairro" text NOT NULL DEFAULT '';
ALTER TABLE "business_rules" ADD COLUMN "endereco_empresa_cidade" text NOT NULL DEFAULT '';
ALTER TABLE "business_rules" ADD COLUMN "endereco_empresa_estado" text NOT NULL DEFAULT '';
ALTER TABLE "business_rules" DROP COLUMN IF EXISTS "area_operacao";