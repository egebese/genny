-- Hand written. drizzle-kit cannot see a rename as a rename, so its version
-- created `canvases` empty, added a NOT NULL column to a populated
-- `canvas_nodes` and left every existing board behind. Its snapshot is correct
-- and kept; only the statements are replaced.
--
-- The board table takes its real name and the new parent takes the old one.
-- Each existing board becomes a project of the same title containing exactly
-- one canvas, and the canvas keeps its own id, so every `/c/<uuid>` already in
-- somebody's history still opens the board it always did.

ALTER TABLE "projects" RENAME TO "canvases";--> statement-breakpoint
ALTER TABLE "canvases" RENAME CONSTRAINT "projects_pkey" TO "canvases_pkey";--> statement-breakpoint
ALTER TABLE "canvases" RENAME CONSTRAINT "projects_id_owner" TO "canvases_id_owner";--> statement-breakpoint
ALTER TABLE "canvases" RENAME CONSTRAINT "projects_owner_id_users_id_fk" TO "canvases_owner_id_users_id_fk";--> statement-breakpoint
ALTER INDEX "projects_owner_updated" RENAME TO "canvases_owner_updated";--> statement-breakpoint
ALTER POLICY "projects_owner_isolation" ON "canvases" RENAME TO "canvases_owner_isolation";--> statement-breakpoint

-- The composite key follows the table it points at, so only its name is stale.
ALTER TABLE "canvas_nodes" RENAME COLUMN "project_id" TO "canvas_id";--> statement-breakpoint
ALTER TABLE "canvas_nodes" RENAME CONSTRAINT "canvas_nodes_project_owner_fk" TO "canvas_nodes_canvas_owner_fk";--> statement-breakpoint
ALTER INDEX "canvas_nodes_project" RENAME TO "canvas_nodes_canvas";--> statement-breakpoint

CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"brief" text,
	"palette" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_id_owner" UNIQUE("id","owner_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_owner_updated" ON "projects" USING btree ("owner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "projects_owner_isolation" ON "projects" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);--> statement-breakpoint

-- Sharing the id is what makes the backfill a mapping rather than a join on
-- title, which would be wrong the moment two boards were called the same thing.
INSERT INTO "projects" ("id", "owner_id", "title", "created_at", "updated_at")
SELECT "id", "owner_id", "title", "created_at", "updated_at" FROM "canvases";--> statement-breakpoint

ALTER TABLE "canvases" ADD COLUMN "project_id" uuid;--> statement-breakpoint
UPDATE "canvases" SET "project_id" = "id";--> statement-breakpoint
ALTER TABLE "canvases" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_project_owner_fk" FOREIGN KEY ("project_id","owner_id") REFERENCES "public"."projects"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvases_project_updated" ON "canvases" USING btree ("project_id","updated_at" DESC NULLS LAST);
