import { describe, it, expect } from 'vitest';
import { doCloudSave, startSaveHeartbeat } from '../save.js';

/**
 * K1/T15: очередь отложенных сохранений + ретраи.
 *
 * doCloudSave(attempt) ретраит ошибки с задержками 5/15/30с (MAX_RETRIES=3),
 * показывает причину вместо молчания и ставит длинный повтор на 2 мин;
 * startSaveHeartbeat раз в минуту досылает грязный сейв.
 * Тест фиксирует, что обе точки входа экспортируются и вызываемы.
 */
describe('save heartbeat / retry queue (K1/T15)', () => {
  it('doCloudSave экспортируется', () => {
    expect(typeof doCloudSave).toBe('function');
  });

  it('startSaveHeartbeat существует', () => {
    expect(typeof startSaveHeartbeat).toBe('function');
  });
});
