CREATE TYPE "public"."batch_generation_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "batch_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"instructions" text NOT NULL,
	"title" text NOT NULL,
	"status" "batch_generation_status" DEFAULT 'queued' NOT NULL,
	"batch_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batch_generations_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "batch_generations_quantity_range" CHECK ("batch_generations"."quantity" BETWEEN 1 AND 12)
);
--> statement-breakpoint
ALTER TABLE "batch_generations" ADD CONSTRAINT "batch_generations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_generations" ADD CONSTRAINT "batch_generations_tenant_id_conversation_id_conversations_tenant_id_id_fk" FOREIGN KEY ("tenant_id","conversation_id") REFERENCES "public"."conversations"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_generations" ADD CONSTRAINT "batch_generations_tenant_id_batch_id_batches_tenant_id_id_fk" FOREIGN KEY ("tenant_id","batch_id") REFERENCES "public"."batches"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "batch_generations_tenant_idx" ON "batch_generations" USING btree ("tenant_id");