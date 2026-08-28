-- The key to `assets` is composite and hand written; drizzle-kit emits a
-- single-column one. A foreign key check is not subject to row level security,
-- so without the owner in the key an actor could file their own description
-- against somebody else's asset.

CREATE TYPE "public"."asset_kind_guess" AS ENUM('product', 'character', 'logo', 'scene', 'texture', 'diagram', 'other');--> statement-breakpoint
CREATE TABLE "asset_facts" (
	"asset_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"short_name" text NOT NULL,
	"kind" "asset_kind_guess" NOT NULL,
	"subject" text NOT NULL,
	"palette" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"group_key" text NOT NULL,
	"model" text NOT NULL,
	"analysed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_facts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "asset_facts" ADD CONSTRAINT "asset_facts_asset_owner_fk" FOREIGN KEY ("asset_id","owner_id") REFERENCES "public"."assets"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_facts" ADD CONSTRAINT "asset_facts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_facts_owner_group" ON "asset_facts" USING btree ("owner_id","group_key");--> statement-breakpoint
CREATE POLICY "asset_facts_owner_isolation" ON "asset_facts" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);