CREATE TABLE IF NOT EXISTS "geocoding_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"address_hash" text NOT NULL,
	"normalized_address" text NOT NULL,
	"postal_code" text,
	"street" text,
	"number" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"country" text DEFAULT 'Brasil' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"source" text NOT NULL,
	"confidence_level" text NOT NULL,
	"confidence_reason" text,
	"raw_provider_display_name" text,
	"provider_payload_summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "geocoding_cache_address_hash_unique" UNIQUE("address_hash")
);

-- Indice para melhorar a performance nas buscas pelo hash
CREATE INDEX IF NOT EXISTS "idx_geocoding_cache_address_hash" ON "geocoding_cache" ("address_hash");
