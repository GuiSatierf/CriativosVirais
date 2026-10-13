ALTER TABLE "assets" ADD COLUMN "upload_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "transcription" jsonb;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "processing_token" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "processing_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "client_message_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_client_unique" ON "messages" USING btree ("tenant_id","conversation_id","client_message_id");--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_token_hash_unique" UNIQUE("token_hash");