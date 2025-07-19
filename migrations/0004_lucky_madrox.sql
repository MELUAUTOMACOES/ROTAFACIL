ALTER TABLE "appointments" ADD COLUMN "all_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "endereco_inicio_cep" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "endereco_inicio_logradouro" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "endereco_inicio_numero" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "endereco_inicio_complemento" text;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "endereco_inicio_cep" text;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "endereco_inicio_logradouro" text;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "endereco_inicio_numero" text;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "endereco_inicio_complemento" text;