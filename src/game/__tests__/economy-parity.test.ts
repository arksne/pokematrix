import { describe, it, expect } from 'vitest';
import { ITEMS } from '../../data/items.js';
import { SERVER_PRICE_MAP } from '../../../server/src/routes/economy.js';

/**
 * Паритет цен клиент/сервер (решение E6-A: сервер — истина).
 * Сервер списывает по своей карте; витрина обязана показывать то же самое,
 * иначе «недостаточно кредитов» при якобы хватающей сумме (и наоборот).
 * Любое изменение цены с одной стороны без другой роняет этот тест.
 */
describe('economy parity (client ITEMS vs server priceMap)', () => {
  it('все серверные цены совпадают с клиентскими', () => {
    const mismatches: string[] = [];
    for (const [id, serverPrice] of SERVER_PRICE_MAP) {
      const client = ITEMS.find((i) => i.id === id);
      if (!client) {
        mismatches.push(`${id}: нет в ITEMS`);
        continue;
      }
      if (client.price !== serverPrice) {
        mismatches.push(`${id}: клиент ${client.price} vs сервер ${serverPrice}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('продаваемое сервером есть в ITEMS и implemented', () => {
    const missing: string[] = [];
    for (const [id, price] of SERVER_PRICE_MAP) {
      if (price <= 0) continue;
      const client = ITEMS.find((i) => i.id === id);
      if (!client || !client.implemented) missing.push(id);
    }
    expect(missing).toEqual([]);
  });
});
