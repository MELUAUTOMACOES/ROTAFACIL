ALTER TABLE "technicians" ALTER COLUMN "bairro" SET DEFAULT 'Não informado';--> statement-breakpoint
ALTER TABLE "technicians" ALTER COLUMN "cidade" SET DEFAULT 'Não informado';--> statement-breakpoint
ALTER TABLE "technicians" ALTER COLUMN "estado" SET DEFAULT 'Não informado';--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "endereco_inicio_bairro" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "endereco_inicio_cidade" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "endereco_inicio_estado" text;