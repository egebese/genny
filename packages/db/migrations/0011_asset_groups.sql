-- Hand written. drizzle-kit reads a rename as a drop and a create, which here
-- would throw away every character anyone had made. Its snapshot is correct and
-- kept; only the statements are replaced.
--
-- A table called `characters` holding four angles of a hoodie is a table nobody
-- can read, so the group is now what it always was and the kind says what it
-- stands for. Everything that exists today is a character, which is the default.

CREATE TYPE "public"."group_kind" AS ENUM('character', 'product', 'style', 'set');--> statement-breakpoint

ALTER TABLE "characters" RENAME TO "asset_groups";--> statement-breakpoint
ALTER TABLE "asset_groups" RENAME CONSTRAINT "characters_pkey" TO "asset_groups_pkey";--> statement-breakpoint
ALTER TABLE "asset_groups" RENAME CONSTRAINT "characters_owner_label" TO "asset_groups_owner_label";--> statement-breakpoint
ALTER TABLE "asset_groups" RENAME CONSTRAINT "characters_owner_id_users_id_fk" TO "asset_groups_owner_id_users_id_fk";--> statement-breakpoint
ALTER POLICY "characters_owner_isolation" ON "asset_groups" RENAME TO "asset_groups_owner_isolation";--> statement-breakpoint
ALTER TABLE "asset_groups" ADD COLUMN "kind" "group_kind" DEFAULT 'character' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_groups" ADD CONSTRAINT "asset_groups_id_owner" UNIQUE("id","owner_id");--> statement-breakpoint

ALTER TABLE "character_assets" RENAME TO "asset_group_members";--> statement-breakpoint
ALTER TABLE "asset_group_members" RENAME COLUMN "character_id" TO "group_id";--> statement-breakpoint
ALTER TABLE "asset_group_members" RENAME CONSTRAINT "character_assets_character_id_asset_id_pk" TO "asset_group_members_pkey";--> statement-breakpoint
ALTER TABLE "asset_group_members" RENAME CONSTRAINT "character_assets_asset_owner_fk" TO "asset_group_members_asset_owner_fk";--> statement-breakpoint
ALTER TABLE "asset_group_members" RENAME CONSTRAINT "character_assets_owner_id_users_id_fk" TO "asset_group_members_owner_id_users_id_fk";--> statement-breakpoint
ALTER POLICY "character_assets_owner_isolation" ON "asset_group_members" RENAME TO "asset_group_members_owner_isolation";--> statement-breakpoint

-- The membership key was single-column and pointed at a table that has only now
-- grown an `(id, owner_id)` unique to point at. A key check is not subject to
-- RLS, so without this an actor could add their asset to somebody else's group.
ALTER TABLE "asset_group_members" DROP CONSTRAINT IF EXISTS "character_assets_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "asset_group_members" ADD CONSTRAINT "asset_group_members_group_owner_fk" FOREIGN KEY ("group_id","owner_id") REFERENCES "public"."asset_groups"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- A reference stored on a job says whether the handle stood for one asset or
-- for a set. The word for the second is no longer "character". Left alone, the
-- vocabulary in old rows would disagree with the vocabulary in new ones, which
-- is the kind of half-rename that reads as a bug for years.
UPDATE "jobs"
   SET "prompt" = jsonb_set("prompt", '{references}', (
     SELECT coalesce(jsonb_agg(
       CASE WHEN reference->>'kind' = 'character'
            THEN jsonb_set(reference, '{kind}', '"group"')
            ELSE reference END
     ), '[]'::jsonb)
     FROM jsonb_array_elements("prompt"->'references') AS reference
   ))
 WHERE "prompt"->'references' @> '[{"kind":"character"}]'::jsonb;
