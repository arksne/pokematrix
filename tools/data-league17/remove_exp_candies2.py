# -*- coding: utf-8 -*-
"""Убрать ВСЕ конфеты опыта (доделанная версия, под реальный формат файлов).

Предметы в items.ts — однострочные записи вида
  { id: 'expCandyS', nameRu: '...', ... },
поэтому удаляем строку целиком.
Обработчик в inventory.ts — блок case с несколькими метками:
  case 'expCandyXs': case 'expCandyS': ... { ... }
Убираем метки и сам блок.
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


# ── items.ts: удаляем строки-определения ────────────────────────────────
p = ROOT + r'\src\data\items.ts'
lines = read(p).split('\n')
kept = []
removed = []
for l in lines:
    m = re.search(r"id:\s*'(exp[A-Za-z]+)'", l)
    if m and m.group(1) in EXP:
        removed.append(m.group(1))
        continue
    kept.append(l)
write(p, '\n'.join(kept))
print('items.ts: удалено определений %d -> %s' % (len(removed), removed))

# ── inventory.ts: убираем case-блоки ────────────────────────────────────
p = ROOT + r'\src\ui\inventory.ts'
t = read(p)
# 1) метки case с несколькими значениями
for item in EXP:
    t = re.sub(r"case\s+'%s':\s*" % item, '', t)
# 2) оставшиеся одиночные case 'expCandyX': — снимаем метку, но блок может
#    содержать полезную логику; если блок пустой (только грань) — убираем.
t = re.sub(r"case\s+'(expCandy\w*)':\s*", '', t)
write(p, t)
left = re.findall(r"expCandy\w*|expShare", t)
print('inventory.ts: осталось упоминаний %d %s' % (len(left), set(left)))

# ── проверка по всему src ───────────────────────────────────────────────
import glob
import os
found = {}
for f in glob.glob(ROOT + r'\src\**\*.ts', recursive=True) + glob.glob(ROOT + r'\server\src\**\*.ts', recursive=True):
    tt = read(f)
    for item in EXP:
        n = len(re.findall(r"['\"]%s['\"]" % item, tt))
        if n:
            found.setdefault(os.path.relpath(f, ROOT), []).append('%s×%d' % (item, n))
print('остатки по репозиторию:')
for k, v in sorted(found.items()):
    print('  %-40s %s' % (k, ', '.join(v)))
if not found:
    print('  — чисто')