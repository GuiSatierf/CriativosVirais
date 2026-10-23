CREATE TYPE "public"."ai_purpose" AS ENUM('chat', 'batch', 'video');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purpose" "ai_purpose" NOT NULL,
	"input_tokens" integer NOT NULL,
	"cached_input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_millicents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_tenant_created_idx" ON "ai_usage" USING btree ("tenant_id","created_at");