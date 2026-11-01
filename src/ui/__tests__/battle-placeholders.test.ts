/**
 * Заглушки боя в index.html не должны выглядеть как настоящие покемоны.
 *
 * На живом проде в момент старта боя (модалка открылась, а клиент ещё тянет
 * данные покемонов — ~1.5 секунды) игрок видел «Groudon Lv50 100/100» против
 * «Pidgey Lv5 10/10»: это были статические заглушки из разметки. Выглядело так,
 * будто начался бой с легендарным Гроудоном, а потом имя менялось на пиплупа.
 * Теперь заглушки нейтральные, а пустые спрайты не рисуют «сломанную картинку».
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('style.css', 'utf8');

/** Вырезать разметку арены боя, чтобы проверять только её. */
function battleMarkup(): string {
  const start = html.indexOf('id="encounter-modal"');
  expect(start, 'в index.html должна быть арена боя').toBeGreaterThan(-1);
  const end = html.indexOf('<!-- /reborn-center-panel -->', start);
  return end > start ? html.slice(start, end) : html.slice(start, start + 4000);
}

describe('заглушки арены боя', () => {
  const battle = battleMarkup();

  it('нет фальшивого «Groudon Lv50» в статике', () => {
    expect(battle).not.toMatch(/Groudon/);
    expect(battle).not.toMatch(/Lv50/);
  });

  it('нет фальшивого «Pidgey Lv5 10/10» в статике', () => {
    expect(battle).not.toMatch(/Pidgey/);
    expect(battle).not.toMatch(/>\s*10\/10\s*</);
    expect(battle).not.toMatch(/>\s*100\/100\s*</);
  });

  it('имена и HP заглушек нейтральные', () => {
    expect(battle).toMatch(/id="player-name"[^>]*>…</);
    expect(battle).toMatch(/id="wild-name"[^>]*>…</);
    expect(battle).toMatch(/id="player-hp-text"[^>]*>—\/—</);
    expect(battle).toMatch(/id="wild-hp-text"[^>]*>—\/—</);
  });

  it('лог боя не рапортует о нападении до прихода данных', () => {
    expect(battle).not.toMatch(/На вас напал дикий покемон/);
    expect(battle).toMatch(/id="battle-log"[^>]*>Бой начинается…</);
  });

  it('пустой спрайт не показывает сломанную картинку', () => {
    expect(css).toMatch(/\.reborn-sprite\[src=""\]\s*\{[^}]*visibility:\s*hidden/);
  });
});
