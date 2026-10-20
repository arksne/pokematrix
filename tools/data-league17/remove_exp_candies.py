# -*- coding: utf-8 -*-
"""Убрать ВСЕ конфеты опыта из игры.

Решение игрока: «убери все конфеты опыта» — они читерские (дают опыт
мгновенно, обходят уровни). Убираем отовсюду, а не только из магазина:

  1. src/data/items.ts   — определения предметов (чтобы нельзя было иметь);
  2. src/data/shops.ts  — ассортимент;
  3. src/data/npc.ts, src/data/npc-packs/*.ts — награды за квесты
     (вместо конфеты опыта выдаётся rareCandy — конфета УРОВНЯ, она нужна
      для эволюции и её игрок просил оставить);
  4. src/ui/inventory.ts — обработчики «использовать».

Убираются: expCandyS, expCandyM, expCandyL, expCandyXl, expCandyXs, expShare.
"""
import io
import re

EXP = ['expCandyS', 'expCandyM', 'expCandyL', 'expCandyXl', 'expCandyXs', 'expShare']
ROOT = r'C:\Users\ARK\pokematrix'


def read(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def write(p, t):
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(t)


def strip_quoted(text, item):
    """Убрать 'item' или "item" вместе с запятой/пробелами."""
    for pat in [r"'%s',\s*" % item, r",\s*'%s'" % item,
                r'"%s",\s*' % item, r",\s*\"%s\"" % item]:
        text = re.sub(pat, '', text)
    return text


# ── 1. items.ts: удаляем блок предмета целиком ────────────────────────────
p = ROOT + r'\src\data\items.ts'
t = read(p)
removed = 0
for item in EXP:
    m = re.search(r"\n  \{\s*\n\s*id:\s*'%s'," % item, t)
    if not m:
        continue
    start = m.start()
    # идём до закрывающей скобки блока
    depth = 0
    i = t.index('{', m.start())
    j = i
    while j < len(t):
        if t[j] == '{':
            depth += 1
        elif t[j] == '}':
            depth -= 1
            if depth == 0:
                break
        j += 1
    t = t[:start] + t[j + 1:]
    removed += 1
write(p, t)
print('items.ts: удалено определений %d' % removed)

# ── 2. shops.ts ──────────────────────────────────────────────────────────
p = ROOT + r'\src\data\shops.ts'
t = read(p)
n = 0
for item in EXP:
    t, k = re.subn(r"'%s',\s*" % item, '', t)
    n += k
    t, k = re.subn(r",\s*'%s'" % item, '', t)
    n += k
    t, k = re.subn(r'"%s",\s*' % item, '', t)
    n += k
    t, k = re.subn(r",\s*\"%s\"" % item, '', t)
    n += k
write(p, t)
print('shops.ts: убрано упоминаний %d' % n)

# ── 3. награды за квесты → rareCandy ──────────────────────────────────────
import glob
files = [ROOT + r'\src\data\npc.ts'] + glob.glob(ROOT + r'\src\data\npc-packs\*.ts')
total = 0
for p in files:
    t = read(p)
    orig = t
    for item in EXP:
        t = t.replace("rewardItem: '%s'" % item, "rewardItem: 'rareCandy'")
        t = t.replace("id: '%s'" % item, "id: 'rareCandy'")
    if t != orig:
        write(p, t)
        total += 1
print('награды за квесты: файлов изменено %d' % total)

# ── 4. inventory.ts: убираем обработчики ─────────────────────────────────
p = ROOT + r'\src\ui\inventory.ts'
t = read(p)
before = len(t)
for item in EXP:
    t = strip_quoted(t, item)
write(p, t)
print('inventory.ts: -%d символов' % (before - len(t)))

print('готово')