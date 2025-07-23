ALTER TABLE "technicians" ADD COLUMN "bairro" text NOT NULL;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "cidade" text NOT NULL;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "estado" text NOT NULL;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "endereco_inicio_bairro" text;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "endereco_inicio_cidade" text;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "endereco_inicio_estado" text;