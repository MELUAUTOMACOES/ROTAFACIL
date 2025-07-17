ALTER TABLE "appointments" ALTER COLUMN "bairro" SET DEFAULT 'Não informado';--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "bairro" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "cidade" SET DEFAULT 'Não informado';--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "cidade" SET NOT NULL;