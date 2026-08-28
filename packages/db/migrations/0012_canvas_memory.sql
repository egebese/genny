-- The key to `canvases` is composite and hand written; drizzle-kit emits a
-- single-column one. A key check is not subject to row level security, so
-- without the owner in it an actor could file a reading against somebody
-- else's board.

CREATE TABLE "canvas_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"node_count_at" integer NOT NULL,
	"facts" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_memory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "canvas_memory" ADD CONSTRAINT "canvas_memory_canvas_owner_fk" FOREIGN KEY ("canvas_id","owner_id") REFERENCES "public"."canvases"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_memory" ADD CONSTRAINT "canvas_memory_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvas_memory_canvas" ON "canvas_memory" USING btree ("canvas_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "canvas_memory_owner_isolation" ON "canvas_memory" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);