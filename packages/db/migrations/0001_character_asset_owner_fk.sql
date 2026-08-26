ALTER TABLE "assets" ADD CONSTRAINT "assets_id_owner" UNIQUE("id","owner_id");--> statement-breakpoint
--
-- A membership must agree with its asset about who owns it.
--
-- drizzle-kit generated the unique constraint above but not the composite
-- foreign key below, so the rest of this file is written by hand. Without it, an
-- actor can bundle somebody else's asset: a foreign key check is not subject to
-- row-level security, so the row inserts, the join hides it, and the character
-- silently resolves to nothing.
--
ALTER TABLE "character_assets" DROP CONSTRAINT IF EXISTS "character_assets_asset_id_assets_id_fk";--> statement-breakpoint
ALTER TABLE "character_assets" ADD CONSTRAINT "character_assets_asset_owner_fk" FOREIGN KEY ("asset_id","owner_id") REFERENCES "public"."assets"("id","owner_id") ON DELETE cascade ON UPDATE no action;
