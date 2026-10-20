# -*- coding: utf-8 -*-
"""Конфеты опыта убраны из игры — заменяем их в наградах за квесты на
предметы СОПОСТАВИМОЙ цены (не rareCandy: он стоит 800 000 и взрывает
лимит «продаваемости наград» тира).

  expCandyXs (20)    -> antidote      (200)
  expCandyS  (240)   -> paralyzeHeal (200)
  expCandyM  (1000)  -> superPotion  (700)
  expCandyL  (3000)  -> revive      (2000)
  expCandyXl (10000) -> hyperPotion (1500)
  expShare   (25000) -> sacredAsh  (50000)
"""
import io
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
    for old, new in REPL.items():
        t = t.replace("rewardItem: '%s'" % old, "rewardItem: '%s'" % new)
        t = t.replace("id: '%s'" % old, "id: '%s'" % new)
        t = t.replace("rewardItem: \"%s\"" % old, "rewardItem: '%s'" % new)
    if t != orig:
        with io.open(p, 'w', encoding='utf-8') as f:
            f.write(t)
        total += 1
        print('  %s: заменено' % os.path.basename(p))
print('файлов: %d' % total)