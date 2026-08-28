-- The two composite keys below are hand written; drizzle-kit emits single-column
-- ones and cannot be told otherwise. A foreign key check is not subject to row
-- level security, so a single-column key would let an actor pin their own asset
-- to somebody else's project, or pin somebody else's asset to their own. Both
-- parents already carry the `(id, owner_id)` unique these point at.

CREATE TYPE "public"."brand_role" AS ENUM('logo', 'product', 'reference');--> statement-breakpoint
CREATE TABLE "project_assets" (
	"project_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"role" "brand_role" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_assets_project_id_asset_id_pk" PRIMARY KEY("project_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "project_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_project_owner_fk" FOREIGN KEY ("project_id","owner_id") REFERENCES "public"."projects"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_asset_owner_fk" FOREIGN KEY ("asset_id","owner_id") REFERENCES "public"."assets"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_assets_project_role" ON "project_assets" USING btree ("project_id","role","sort_order");--> statement-breakpoint
CREATE POLICY "project_assets_owner_isolation" ON "project_assets" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);