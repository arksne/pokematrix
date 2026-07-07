CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drop_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"monster_drops" text DEFAULT '{}' NOT NULL,
	"universal_drops" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pokemon_cache" (
	"name" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"fetched_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "server_features" (
	"feature" text PRIMARY KEY NOT NULL,
	"enabled" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tg_id" integer NOT NULL,
	"username" text,
	"first_name" text,
	"nickname" text DEFAULT '',
	"avatar" text DEFAULT 'trainer_f',
	"registered" integer DEFAULT 0,
	"is_admin" integer DEFAULT 0,
	"save_data" text DEFAULT '{}',
	"save_version" integer DEFAULT 0,
	"money" integer DEFAULT 500,
	"badges_count" integer DEFAULT 0,
	"pokemon_count" integer DEFAULT 0,
	"created_at" text,
	"last_seen" text,
	"location_id" text DEFAULT 'goldenrodCity',
	"region" text DEFAULT 'johto',
	CONSTRAINT "users_tg_id_unique" UNIQUE("tg_id")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;