-- 0007: battle_audit — постоянный журнал lifecycle боёв/обменов/отклонённых сейвов.
-- (сгенерировано drizzle-kit, вручную урезано до новой таблицы: остальное —
-- дрейф снапшотов meta против рукописных миграций 0003–0006, эти объекты уже созданы).
CREATE TABLE "battle_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"kind" text NOT NULL,
	"session_id" text,
	"actor_tg" bigint,
	"detail" text DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX "battle_audit_created_idx" ON "battle_audit" USING btree ("created_at");
