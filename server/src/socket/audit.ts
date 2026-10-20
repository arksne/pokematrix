/**
 * Постоянный журнал lifecycle боёв/обменов/отклонённых сейвов.
 * Пишет в battle_audit fire-and-forget: любая ошибка записи гасится,
 * аудит НИКОГДА не ломает геймплей и не ждёт ответа БД.
 */
import { getDb } from '../db/index.js';
import { battleAudit } from '../db/schema.js';

export type AuditKind =
  | 'pvp_start'
  | 'pvp_end'
  | 'pvp_settle'
  | 'arena_join'
  | 'trade_execute'
  | 'save_reject';

export function audit(e: {
  kind: AuditKind;
  sessionId?: string;
  actorTg?: unknown;
  detail?: unknown;
}): void {
  try {
    void getDb()
      .insert(battleAudit)
      .values({
        created_at: new Date().toISOString(),
        kind: e.kind,
        session_id: e.sessionId ?? null,
        actor_tg: typeof e.actorTg === 'number' ? e.actorTg : null,
        detail: JSON.stringify(e.detail ?? {}).slice(0, 2000),
      })
      .catch(() => {
        // Аудит не должен ломать игру — молча пропускаем.
      });
  } catch {
    // getDb() до connect — тоже молча.
  }
}
