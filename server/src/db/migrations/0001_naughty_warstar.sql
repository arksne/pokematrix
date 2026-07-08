CREATE TABLE "battle_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"rating" integer DEFAULT 1000,
	"wins" integer DEFAULT 0,
	"losses" integer DEFAULT 0,
	"updated_at" text,
	CONSTRAINT "battle_ratings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "battle_ratings" ADD CONSTRAINT "battle_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
