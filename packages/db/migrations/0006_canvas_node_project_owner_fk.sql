ALTER TABLE "projects" ADD CONSTRAINT "projects_id_owner" UNIQUE("id","owner_id");--> statement-breakpoint
--
-- A node must agree with its project about who owns it.
--
-- Same reasoning as 0001: a foreign key check is not subject to row-level
-- security, so without this an actor can insert nodes into somebody else's
-- board. The rows stay invisible to the owner, which makes it graffiti rather
-- than a leak, but there is no reason to allow the write at all.
--
-- drizzle-kit generates the unique constraint and not the composite key, so the
-- rest of this file is written by hand.
--
ALTER TABLE "canvas_nodes" DROP CONSTRAINT IF EXISTS "canvas_nodes_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "canvas_nodes" ADD CONSTRAINT "canvas_nodes_project_owner_fk" FOREIGN KEY ("project_id","owner_id") REFERENCES "public"."projects"("id","owner_id") ON DELETE cascade ON UPDATE no action;
