CREATE TYPE "public"."agent_kind" AS ENUM('variants', 'catalogue', 'memory', 'director');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "agent_kind" NOT NULL,
	"model" text NOT NULL,
	"canvas_id" uuid,
	"input" jsonb NOT NULL,
	"output" text,
	"error" text,
	"cost_usd" numeric(12, 6),
	"tokens" numeric(12, 0),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_owner_created" ON "agent_runs" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "agent_runs_owner_isolation" ON "agent_runs" AS PERMISSIVE FOR ALL TO "genny_app" USING (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid) WITH CHECK (owner_id = nullif(current_setting('app.actor_id', true), '')::uuid);