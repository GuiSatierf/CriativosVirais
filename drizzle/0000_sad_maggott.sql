CREATE TYPE "public"."asset_kind" AS ENUM('video', 'audio');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('uploaded', 'processing', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."client_state" AS ENUM('A_validado', 'B_sinais', 'C_zero');--> statement-breakpoint
CREATE TYPE "public"."evidence_level" AS ENUM('hipotese', 'sinal_atencao', 'sinal_clique', 'sinal_lead', 'sinal_venda', 'validacao_economica', 'repetido');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('utmify', 'vkmetrics', 'csv', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('pending', 'approved', 'refunded', 'chargeback', 'cancelled', 'failed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"creative_id" uuid,
	"kind" "asset_kind" NOT NULL,
	"s3_key" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"duration_s" double precision,
	"status" "asset_status" DEFAULT 'uploaded' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "batch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"creative_key" text NOT NULL,
	"ideia" text NOT NULL,
	"formato" text DEFAULT '' NOT NULL,
	"referencia" text DEFAULT '' NOT NULL,
	"instrucoes_gravacao" text DEFAULT '' NOT NULL,
	"instrucoes_edicao" text DEFAULT '' NOT NULL,
	"g1" text NOT NULL,
	"g2" text NOT NULL,
	"g3" text NOT NULL,
	"corpo" text NOT NULL,
	"narrativa" text NOT NULL,
	"awareness_entry" text NOT NULL,
	"awareness_exit" text NOT NULL,
	"skeleton" text NOT NULL,
	"hipotese" text NOT NULL,
	"bloco_testado" text NOT NULL,
	"prova_usada" text NOT NULL,
	"duracao_estimada" integer NOT NULL,
	CONSTRAINT "batch_items_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "batch_items_position_positive" CHECK ("batch_items"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"produto_nome" text NOT NULL,
	"especialista_handle" text,
	"round_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batches_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "batches_round_positive" CHECK ("batches"."round_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "client_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"produto" text,
	"publico" text,
	"transformacao" text,
	"mecanismo" text,
	"ticket_cents" bigint,
	"tipo_funil" text,
	"proximo_passo_funil" text,
	"provas_autorizadas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"objecoes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"restricoes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estado_cliente" "client_state",
	"especialista_handle" text,
	"produto_nome" text,
	"notas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_contexts_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "creative_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"creative_id" uuid NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"spend_cents" bigint,
	"impressions" bigint,
	"clicks" bigint,
	"ctr" double precision,
	"hook_rate" double precision,
	"body_rate" double precision,
	"leads" bigint,
	"checkouts" bigint,
	"approved_sales" bigint,
	"revenue_cents" bigint,
	"profit_cents" bigint,
	"roas" double precision,
	"refunds" bigint,
	"chargebacks" bigint,
	"source" text NOT NULL,
	"confidence" text,
	CONSTRAINT "creative_metrics_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "creative_metrics_period_check" CHECK ("creative_metrics"."period_from" <= "creative_metrics"."period_to")
);
--> statement-breakpoint
CREATE TABLE "creative_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"creative_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"metric_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creative_selections_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"creative_key" text NOT NULL,
	"name" text,
	"campaign_key" text,
	"adset_key" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creatives_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"credentials_encrypted" text,
	"webhook_secret_encrypted" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	CONSTRAINT "integrations_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"batch_id" uuid,
	"creative_id" uuid,
	"texto" text NOT NULL,
	"evidence_level" "evidence_level" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learnings_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sales_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"status" "sale_status" NOT NULL,
	"currency" text NOT NULL,
	"revenue_cents" bigint,
	"profit_cents" bigint,
	"creative_key" text,
	"utm_source" text,
	"utm_campaign" text,
	"utm_medium" text,
	"utm_content" text,
	"utm_term" text,
	"source" text NOT NULL,
	"raw" jsonb NOT NULL,
	CONSTRAINT "sales_events_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "sales_events_currency_check" CHECK ("sales_events"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shared_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"descricao" text NOT NULL,
	"esqueleto" text,
	"nivel_consciencia" text,
	"condicoes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_level" "evidence_level" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'owner' NOT NULL,
	CONSTRAINT "tenant_members_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"creative_id" uuid,
	"transcript" text NOT NULL,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"narrative" text NOT NULL,
	"awareness_entry" text NOT NULL,
	"awareness_exit" text NOT NULL,
	"skeleton" text NOT NULL,
	"format" text NOT NULL,
	"proof_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cta" text NOT NULL,
	"visual_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uncertainties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_analyses_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_creative_id_creatives_tenant_id_id_fk" FOREIGN KEY ("tenant_id","creative_id") REFERENCES "public"."creatives"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_tenant_id_batch_id_batches_tenant_id_id_fk" FOREIGN KEY ("tenant_id","batch_id") REFERENCES "public"."batches"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_tenant_id_conversation_id_conversations_tenant_id_id_fk" FOREIGN KEY ("tenant_id","conversation_id") REFERENCES "public"."conversations"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contexts" ADD CONSTRAINT "client_contexts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_metrics" ADD CONSTRAINT "creative_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_metrics" ADD CONSTRAINT "creative_metrics_tenant_id_creative_id_creatives_tenant_id_id_fk" FOREIGN KEY ("tenant_id","creative_id") REFERENCES "public"."creatives"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_selections" ADD CONSTRAINT "creative_selections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_selections" ADD CONSTRAINT "creative_selections_tenant_id_creative_id_creatives_tenant_id_id_fk" FOREIGN KEY ("tenant_id","creative_id") REFERENCES "public"."creatives"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_tenant_id_batch_id_batches_tenant_id_id_fk" FOREIGN KEY ("tenant_id","batch_id") REFERENCES "public"."batches"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_tenant_id_creative_id_creatives_tenant_id_id_fk" FOREIGN KEY ("tenant_id","creative_id") REFERENCES "public"."creatives"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_conversation_id_conversations_tenant_id_id_fk" FOREIGN KEY ("tenant_id","conversation_id") REFERENCES "public"."conversations"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_tenant_id_asset_id_assets_tenant_id_id_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."assets"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_tenant_id_creative_id_creatives_tenant_id_id_fk" FOREIGN KEY ("tenant_id","creative_id") REFERENCES "public"."creatives"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "assets_tenant_idx" ON "assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_key_unique" ON "assets" USING btree ("tenant_id","s3_key");--> statement-breakpoint
CREATE INDEX "batch_items_tenant_idx" ON "batch_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "batch_items_position_unique" ON "batch_items" USING btree ("tenant_id","batch_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "batch_items_key_unique" ON "batch_items" USING btree ("tenant_id","creative_key");--> statement-breakpoint
CREATE INDEX "batches_tenant_idx" ON "batches" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "batches_round_unique" ON "batches" USING btree ("tenant_id","round_number");--> statement-breakpoint
CREATE INDEX "client_contexts_tenant_idx" ON "client_contexts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_contexts_tenant_unique" ON "client_contexts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "conversations_tenant_idx" ON "conversations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "creative_metrics_tenant_idx" ON "creative_metrics" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creative_metrics_period_unique" ON "creative_metrics" USING btree ("tenant_id","creative_id","period_from","period_to","source");--> statement-breakpoint
CREATE INDEX "creative_selections_tenant_idx" ON "creative_selections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "creatives_tenant_idx" ON "creatives" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creatives_key_unique" ON "creatives" USING btree ("tenant_id","creative_key");--> statement-breakpoint
CREATE INDEX "integrations_tenant_idx" ON "integrations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_provider_unique" ON "integrations" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX "learnings_tenant_idx" ON "learnings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "messages_tenant_idx" ON "messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_events_tenant_idx" ON "sales_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_events_idempotency_unique" ON "sales_events" USING btree ("tenant_id","event_id");--> statement-breakpoint
CREATE INDEX "sales_events_creative_period_idx" ON "sales_events" USING btree ("tenant_id","creative_key","occurred_at");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_members_tenant_idx" ON "tenant_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_members_user_unique" ON "tenant_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "video_analyses_tenant_idx" ON "video_analyses" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_analyses_asset_unique" ON "video_analyses" USING btree ("tenant_id","asset_id");