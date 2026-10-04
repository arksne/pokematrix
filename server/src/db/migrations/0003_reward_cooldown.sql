ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_reward_at" bigint DEFAULT 0;
