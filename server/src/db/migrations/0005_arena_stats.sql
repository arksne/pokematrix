CREATE TABLE IF NOT EXISTS "arena_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"wins" integer DEFAULT 0,
	"streak" integer DEFAULT 0,
	"best" integer DEFAULT 0,
	"updated_at" text,
	CONSTRAINT "arena_stats_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "arena_stats" ADD CONSTRAINT "arena_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
