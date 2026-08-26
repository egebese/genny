CREATE TYPE "public"."asset_kind" AS ENUM('image', 'video', 'audio');--> statement-breakpoint
CREATE TYPE "public"."asset_source" AS ENUM('upload', 'generation', 'external');--> statement-breakpoint
CREATE TYPE "public"."actor_kind" AS ENUM('anonymous', 'registered');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('grant', 'topup', 'hold', 'capture', 'refund', 'expire');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('image', 'video', 'audio');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"label" text NOT NULL,
	"storage_key" text NOT NULL,
	"thumb_key" text,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"source" "asset_source" NOT NULL,
	"job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_owner_label" UNIQUE("owner_id","label")
);
--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "character_assets" (
	"character_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "character_assets_character_id_asset_id_pk" PRIMARY KEY("character_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "character_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_owner_label" UNIQUE("owner_id","label")
);
--> statement-breakpoint
ALTER TABLE "characters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "actor_kind" DEFAULT 'anonymous' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_balance" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"balance" numeric(14, 4) DEFAULT '0' NOT NULL,
	"hold_balance" numeric(14, 4) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_balance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"delta" numeric(14, 4) NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"job_id" uuid,
	"idempotency_key" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"endpoint_id" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"fal_request_id" text,
	"prompt" jsonb NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"credits_held" numeric(14, 4),
	"credits_charged" numeric(14, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_fal_request_id_unique" UNIQUE("fal_request_id")
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "models" (
	"endpoint_id" text PRIMARY KEY NOT NULL,
	"modality" "modality" NOT NULL,
	"group" text NOT NULL,
	"display_name" text NOT NULL,
	"thumbnail_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"unit" text NOT NULL,
	"unit_price_usd" numeric(12, 6) NOT NULL,
	"credit_multiplier" numeric(6, 3) DEFAULT '1.0' NOT NULL,
	"catalog_hash" text NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_buckets_bucket_window_start_pk" PRIMARY KEY("bucket","window_start")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_assets" ADD CONSTRAINT "character_assets_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_assets" ADD CONSTRAINT "character_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_assets" ADD CONSTRAINT "character_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_endpoint_id_models_endpoint_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."models"("endpoint_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_owner_created" ON "assets" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "credit_ledger_owner_created" ON "credit_ledger" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_owner_created" ON "jobs" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_status_pending" ON "jobs" USING btree ("status","created_at") WHERE status in ('queued', 'running');--> statement-breakpoint
CREATE POLICY "assets_owner_isolation" ON "assets" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "character_assets_owner_isolation" ON "character_assets" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "characters_owner_isolation" ON "characters" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "users_self_read" ON "users" AS PERMISSIVE FOR SELECT TO "genny_app" USING (id = nullif(current_setting('app.actor_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "credit_balance_owner_isolation" ON "credit_balance" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "credit_ledger_owner_isolation" ON "credit_ledger" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "jobs_owner_isolation" ON "jobs" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "models_public_read" ON "models" AS PERMISSIVE FOR SELECT TO "genny_app" USING (true);