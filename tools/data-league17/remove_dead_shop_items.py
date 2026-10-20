# -*- coding: utf-8 -*-
"""Убрать из продажи мёртвый и читерский контент.

Игрок решил: мёртвый контент убрать из продажи + убрать конфеты опыта.

Убираем из ассортимента ВСЕХ магазинов:
  * 12 предметов с isUsable:false (репелы, приманки, флейты, спасательная
    верёвка, покебол, покетой, пушистый хвост) — обработчики есть, но кнопка
    «Юз» не рисуется, товар просто не работает;
  * 5 шаров с выдуманными эффектами (master/nest/net/repeat/sport);
  * конфеты опыта (expCandyXl, expShare) — читерские;
  * craftersKit — вход в крафт, рецепты которого требуют материалов,
    которых в игре нет вообще.
"""
import io
import re

FP = r'C:\Users\ARK\pokematrix\src\data\shops.ts'

REMOVE = [
    'repel', 'superRepel', 'maxRepel', 'lure', 'superLure', 'maxLure',
    'blackFlute', 'whiteFlute', 'escapeRope', 'pokeDoll', 'pokeToy', 'fluffyTail',
    'masterBall', 'nestBall', 'netBall', 'repeatBall', 'sportBall',
    'expCandy', 'expCandyXs', 'expCandyXl', 'expShare',
    'craftersKit',
]


def strip_item(list_body, item):
    """Убрать 'item' из массива-строки (в любом из форматов)."""
    pats = [
        (r"'%s',\s*" % re.escape(item), ''),
        (r",\s*'%s'" % re.escape(item), ''),
        (r'"%s",\s*' % re.escape(item), ''),
        (r",\s*\"%s\"" % re.escape(item), ''),
    ]
    out = list_body
    for pat, rep in pats:
        out = re.sub(pat, rep, out)
    return out


with io.open(FP, encoding='utf-8') as f:
    src = f.read()

# каждое упоминание в массивах ассортимента
removed = 0
for item in REMOVE:
    for pat, rep in [
        (r"'%s',\s*" % re.escape(item), ''),
        (r",\s*'%s'" % re.escape(item), ''),
        (r'"%s",\s*' % re.escape(item), ''),
        (r",\s*\"%s\"" % re.escape(item), ''),
    ]:
        src, n = re.subn(pat, rep, src)
        removed += n

with io.open(FP, 'w', encoding='utf-8') as f:
    f.write(src)

print('removed mentions: %d' % removed)
# проверка
left = [i for i in REMOVE if re.search(r"['\"]%s['\"]" % re.escape(i), src)]
print('still present:', left or '—')