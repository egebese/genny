-- Three things assets could not do, and one column that never did anything.
--
-- Deleting: there was no path at all. `deleted_at` rather than a real DELETE,
-- because a canvas node points at the asset it drew and a hard delete cascades
-- those nodes off somebody's board without warning. The row stays as a
-- tombstone, the bytes in the bucket do not, and the node says the media is
-- gone. Every read path filters on this.
ALTER TABLE "assets" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint

-- Partial, because every listing asks the same question and the dead rows are
-- the minority nobody queries for.
CREATE INDEX "assets_owner_live" ON "assets" USING btree ("owner_id","created_at" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint

-- Written by nothing and read by nothing since thumbnails moved to a key
-- derived from the storage key and a width. It was a single flag for what
-- turned out to be three files, which is how a request for a 512 wide copy
-- once found the flag set, missed its file, and served the 18MB original.
ALTER TABLE "assets" DROP COLUMN "thumb_key";--> statement-breakpoint

-- The last single-column reference to an asset anywhere. A key check is not
-- subject to RLS, so this one let a node name an asset belonging to somebody
-- else; every other table that points at an asset was made composite when the
-- groups were renamed and this one was missed.
ALTER TABLE "canvas_nodes" DROP CONSTRAINT IF EXISTS "canvas_nodes_asset_id_assets_id_fk";--> statement-breakpoint
ALTER TABLE "canvas_nodes" ADD CONSTRAINT "canvas_nodes_asset_owner_fk" FOREIGN KEY ("asset_id","owner_id") REFERENCES "public"."assets"("id","owner_id") ON DELETE cascade ON UPDATE no action;
