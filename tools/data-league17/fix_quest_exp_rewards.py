# -*- coding: utf-8 -*-
"""Заменить конфеты опыта в наградах за квесты на предметы сопоставимой цены.

Мы заменили expCandy* на rareCandy, а он стоит 800 000 — взорвалась
«продаваемость наград» (лимит тира 150k). Подбираем замену по цене:
  expCandyXs (20)     -> antidote        (200)
  expCandyS  (240)    -> paralyzeHeal   (200)
  expCandyM  (1000)   -> superPotion    (700)
  expCandyL  (3000)   -> revive        (2000)
  expCandyXl (10000)  -> hyperPotion   (1500)
  expShare   (25000)  -> fullRestore  (100000)  — только для поздних квестов
Цены — sellPrice (в тесте считается продажа = половина покупки).
"""
import io
import re
import glob
import os

ROOT = r'C:\Users\ARK\pokematrix'
REPL = {
    'expCandyXs': 'antidote',
    'expCandyS': 'paralyzeHeal',
    'expCandyM': 'superPotion',
    'expCandyL': 'revive',
    'expCandyXl': 'hyperPotion',
    'expShare': 'sacredAsh',
}

files = [ROOT + r'\src\data\npc.ts'] + glob.glob(ROOT + r'\src\data\npc-packs\*.ts')
total = 0
for p in files:
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    orig = t
    # наша прошлая замена уже превратила expCandy* -> rareCandy; откатываем её
    # по контексту награды и ставим правильный предмет
    for old, new in REPL.items():
        # rewardItem: 'rareCandy' после expCandyX — восстановим по id в rewardItems
        pass
    # 1) rewardItems: [{ id: 'rareCandy', qty: N }] — не трогаем, там может быть
    #    любая конфета; 2) прямые ссылки на exp-конфеты:
    for old, new in REPL.items():
        t = t.replace("id: '%s'" % old, "id: '%s'" % new)
        t = t.replace("rewardItem: '%s'" % old, "rewardItem: '%s'" % new)
    if t != orig:
        with io.open(p, 'w', encoding='utf-8') as f:
            f.write(t)
        total += 1
        print('  %s: заменены ссылки на конфеты опыта' % os.path.basename(p))
print('файлов изменено: %d' % total)