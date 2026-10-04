CREATE TABLE IF NOT EXISTS "save_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"save_data" text,
	"save_version" integer DEFAULT 0,
	"reason" text,
	"created_at" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "save_history_user_id_idx" ON "save_history" ("user_id");
--> statement-breakpoint
ALTER TABLE "save_history" ADD CONSTRAINT "save_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
