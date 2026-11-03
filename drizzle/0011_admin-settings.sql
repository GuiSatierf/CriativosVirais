CREATE TYPE "public"."access_end_policy" AS ENUM('immediate', 'end_of_period');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"hotmart_hottok" text,
	"hotmart_product_ids" text[],
	"ai_monthly_limit_cents" bigint,
	"access_end_policy" "access_end_policy" DEFAULT 'immediate' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_single_row" CHECK ("app_settings"."id" = 1)
);
