/**
 * Схема save_data против настоящего сейва клиента.
 *
 * Схема и клиент разошлись по типам, и это ломало облачное сохранение у всех:
 * getTrainerId() возвращает tgUser.id, то есть число, а схема требовала строку,
 * поэтому каждый POST /save отвечал 422 «myTeam.0.originalTrainer: Expected
 * string, received number». Прогресс оставался только в localStorage, о потере
 * сообщал лишь значок ☁️✗, и 1207 непроходимых предметов в инвентаре давали
 * второй, независимый 422 на любое новое сохранение.
 *
 * Фикстура — сейв, снятый с прода из реального броузера у тестового аккаунта
 * после выбора стартовика. Она нужна, потому что писать руками «правильный»
 * сейв бесполезно: именно расхождение с тем, что реально отправляет клиент,
 * и ломало сохранение. Тест берёт dist сервера, поэтому запускать его нужно
 * после `npm --prefix server run build`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SERVER_DIR } from './paths.mjs';

const { validateSaveData } = await import(
  pathToFileURL(path.join(SERVER_DIR, 'dist', 'validation', 'save-data.js')).href
);

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'real-client-save.json');
const raw = readFileSync(FIXTURE, 'utf8');
const save = JSON.parse(raw);
const result = validateSaveData(save);

if (result.success) {
  console.log(`[S10] PASS  схема принимает настоящий сейв клиента  — ${raw.length} байт, myTeam=${(save.myTeam || []).length}`);
  process.exit(0);
}

console.log(`[S10] FAIL  схема отклоняет настоящий сейв клиента  — ${result.errors.length} расхождений`);
for (const e of result.errors.slice(0, 25)) {
  console.log(`        ${e.path || '(корень)'}: ${e.message}`);
}
process.exit(1);
