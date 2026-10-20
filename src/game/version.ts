/**
 * Сверка свежести клиента с продом.
 *
 * Диагностика вечных «у меня сломано / у тебя работает»: Telegram-вебвью
 * агрессивно кэширует бандл, и игрок может сутками сидеть на старом коде,
 * где баги уже починены на сервере. Клиент при старте спрашивает у сервера
 * его коммит (/api/version) и сравнивает со своим, вшитым на сборке
 * (__BUILD_COMMIT__ из vite.config.js). Разошлись — показываем неснимаемый
 * баннер с кнопкой перезагрузки. Совпали или сравнить нельзя — молчим.
 */
import { API_BASE } from './config.js';

declare const __BUILD_COMMIT__: string | undefined;

const HEX40 = /^[0-9a-f]{4,40}$/i;

export function isStaleBuild(serverCommit: unknown, clientCommit: unknown): boolean {
  if (typeof serverCommit !== 'string' || typeof clientCommit !== 'string') return false;
  const s = serverCommit.trim().toLowerCase();
  const c = clientCommit.trim().toLowerCase();
  if (s === 'dev' || c === 'dev' || !s || !c) return false;
  if (!HEX40.test(s) || !HEX40.test(c)) return false;
  // Префиксы одного коммита (7 vs 12 символов) — не stale.
  if (s.startsWith(c) || c.startsWith(s)) return false;
  return s !== c;
}

export function clientBuildCommit(): string {
  try {
    return typeof __BUILD_COMMIT__ !== 'undefined' && __BUILD_COMMIT__ ? String(__BUILD_COMMIT__) : 'dev';
  } catch {
    return 'dev';
  }
}

export async function checkClientFreshness(): Promise<void> {
  const mine = clientBuildCommit();
  let server = '';
  try {
    const res = await fetch(`${API_BASE}/api/version`);
    if (!res.ok) return;
    const data = await res.json();
    server = typeof data?.commit === 'string' ? data.commit : '';
  } catch {
    return; // офлайн / прогрев — не шумим, проверим в следующий запуск
  }
  // eslint-disable-next-line no-console
  console.log(`[version] client=${mine} server=${server || '?'} stale=${isStaleBuild(server, mine)}`);
  if (!isStaleBuild(server, mine)) return;
  if (document.getElementById('build-stale-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'build-stale-banner';
  bar.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#ff3b30;color:#fff;border-radius:10px;padding:10px 12px;font:600 13px/1.4 system-ui,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,.4)';
  const label = document.createElement('span');
  label.style.flex = '1';
  label.textContent = `Вышло обновление игры (${server}). Перезапусти, иначе баги уже починенного кода останутся.`;
  const btn = document.createElement('button');
  btn.textContent = '↻ Обновить';
  btn.style.cssText = 'background:#fff;color:#ff3b30;border:none;border-radius:8px;padding:8px 14px;font:700 13px system-ui;cursor:pointer;';
  btn.onclick = () => location.reload();
  bar.appendChild(label);
  bar.appendChild(btn);
  document.body.appendChild(bar);
}
