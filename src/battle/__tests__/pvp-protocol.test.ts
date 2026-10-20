/**
 * Паритет протокола PvP/арены: клиент ↔ сервер.
 *
 * Каждый сокет-событийный мост обязан быть замкнут с обеих сторон:
 * всё, что шлёт клиент, сервер слушает; всё, что шлёт сервер, клиент
 * обрабатывает. Незамкнутое событие = молчаливый вис боя:
 * сервер шлёт `pvp_opponent_left`, клиент его игнорирует — модалка
 * навсегда остаётся на «Ожидание хода соперника...».
 *
 * Именно так были найдены висяки pvp_opponent_left и pvp_action_rejected.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.cwd();
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

function emitted(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/\.emit\('([^']+)'/g)) out.add(m[1]);
  return [...out];
}

function listened(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/\.on\('([^']+)'/g)) out.add(m[1]);
  return [...out];
}

// Только PvP/арена: трейд (trade_*) и лобби живут в своих модулях со своими тестами.
const isPvp = (ev: string) => ev.startsWith('pvp_') || ev.startsWith('arena_');
// socket.io-служебные, не протокол игры.
const SOCKET_LIFECYCLE = new Set(['connect', 'connect_error', 'disconnect', 'reconnect_attempt']);

describe('pvp protocol parity (client <-> server)', () => {
  const server = read('server/src/socket/pvp.ts');
  const client = [
    read('src/battle/pvp-core.ts'),
    read('src/ui/pvp-arena.ts'),
    read('src/network/socket.ts'),
  ].join('\n');

  const serverListens = listened(server).filter(isPvp);
  const serverEmits = emitted(server).filter(isPvp);
  const clientEmits = emitted(client).filter(isPvp);
  const clientListens = listened(client).filter((e) => isPvp(e) && !SOCKET_LIFECYCLE.has(e));

  it('всё, что шлёт клиент, сервер слушает', () => {
    const missing = clientEmits.filter((e) => !serverListens.includes(e));
    expect(missing, `сервер не слушает: ${missing.join(', ')}`).toEqual([]);
  });

  it('всё, что шлёт сервер, клиент обрабатывает', () => {
    const missing = serverEmits.filter((e) => !clientListens.includes(e));
    expect(missing, `клиент игнорирует (вис боя!): ${missing.join(', ')}`).toEqual([]);
  });
});
