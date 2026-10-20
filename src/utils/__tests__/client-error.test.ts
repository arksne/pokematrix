import { describe, it, expect } from 'vitest';
import { clientErrorBlob } from '../dom.js';

/**
 * Отчётчик клиентских ошибок обязан слать application/json.
 *
 * Ловушка, из-за которой продские логи были полны пустых
 * {msg:'',src:'',url:''}: sendBeacon(url, строка) уходит с
 * Content-Type: text/plain, а express.json() такой тип не парсит —
 * req.body пуст и все отчёты об ошибках молча терялись.
 * Blob с явным типом чинит доставку, семантика sendBeacon сохраняется.
 */
describe('clientErrorBlob', () => {
  it('кладёт JSON с типом application/json', async () => {
    const payload = { msg: 'boom', stack: 'at foo', time: 123 };
    const b = clientErrorBlob(payload);
    expect(b).toBeInstanceOf(Blob);
    expect(b.type).toBe('application/json');
    expect(JSON.parse(await b.text())).toEqual(payload);
  });

  it('не падает на пустом/мусорном входе', async () => {
    for (const p of [undefined, null, 0, 'x']) {
      const b = clientErrorBlob(p);
      expect(b.type).toBe('application/json');
      expect(typeof (await b.text())).toBe('string');
    }
  });
});
