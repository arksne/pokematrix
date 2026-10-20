/**
 * Паритет протокола трейда: клиент ↔ сервер.
 *
 * Тот же класс багов, что pvp-protocol: сервер шлёт событие, клиент его
 * не слушает (молчаливый вис), или клиент шлёт то, что сервер не ждёт.
 * Здесь поймано: trade_execute без data ронял обработчик клиента, а
 * trade_offer_rejected вообще никто не слушал — отклонённые офферы
 * тонули без единого сообщения.
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

const isTrade = (ev: string) => ev.startsWith('trade_');

describe('trade protocol parity (client <-> server)', () => {
  const server = read('server/src/socket/trade.ts');
  const client = [
    read('src/network/socket.ts'),
    ...['trade-center', 'trade-window', 'trade-request'].map((f) => {
      try { return read(`src/ui/${f}.ts`); } catch { return read(`src/ui/${f}.js`); }
    }),
  ].join('\n');

  const serverListens = listened(server).filter(isTrade);
  const serverEmits = emitted(server).filter(isTrade);
  const clientEmits = emitted(client).filter(isTrade);
  const clientListens = listened(client).filter(isTrade);

  it('всё, что шлёт клиент, сервер слушает', () => {
    const missing = clientEmits.filter((e) => !serverListens.includes(e));
    expect(missing, `сервер не слушает: ${missing.join(', ')}`).toEqual([]);
  });

  it('всё, что шлёт сервер, клиент обрабатывает', () => {
    const missing = serverEmits.filter((e) => !clientListens.includes(e));
    expect(missing, `клиент игнорирует: ${missing.join(', ')}`).toEqual([]);
  });
});
