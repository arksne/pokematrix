# -*- coding: utf-8 -*-
"""roamingKanto: привязать к Виридиану.

Флаг roaming: true объявлен в типах, но НИГДЕ не используется в коде —
механика «блуждающие легенды» не реализована, и зона с энкаунтерами
(entei/raikou/suicune) была мёртвым контентом. Раз игрок решил вернуть
недостижимые локации в игру с гейтом по значкам — делаем их обычными
локациями: физический вход + поздний гейт.

roamingJohto уже привязан к Блэкторну (последний город Джото).
"""
import io
import re

FP = r'C:\Users\ARK\pokematrix\src\data\regions.ts'
ANCHOR, TARGET, BADGES = 'viridianCity', 'roamingKanto', 16


def block_span(src, loc):
    m = re.search(r'^\s*' + re.escape(loc) + r':\s*\{', src, re.M)
    if not m:
        return None
    depth = 0
    i = m.end() - 1
    while i < len(src):
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
            if depth == 0:
                return m.start(), i + 1
        i += 1
    return None


def patch_links(block, target):
    m = re.search(r"links:\s*\[", block)
    if not m:
        return None
    depth, i = 1, m.end()
    while i < len(block) and depth:
        if block[i] == '[':
            depth += 1
        elif block[i] == ']':
            depth -= 1
            if depth == 0:
                break
        i += 1
    inner = block[m.end():i]
    if ("'%s'" % target) in inner:
        return block
    sep = ', ' if inner.strip() else ''
    return block[:m.end()] + inner.rstrip() + sep + "'%s'" % target + block[i:]


def patch_gate(block, badges):
    if 'requiresBadges:' in block:
        return block
    m = re.search(r'\n([ ]{8})(hasWater|hasHeal|encounters|links):', block)
    if not m:
        m = re.search(r'\n([ ]{8})\w+:', block)
    if not m:
        return None
    indent = m.group(1)
    return block[:m.start()] + '\n%srequiresBadges: %d,' % (indent, badges) + block[m.start():]


with io.open(FP, encoding='utf-8') as f:
    src = f.read()

for a, t in ((ANCHOR, TARGET), (TARGET, ANCHOR)):
    sp = block_span(src, a)
    assert sp, 'no block ' + a
    b = src[sp[0]:sp[1]]
    nb = patch_links(b, t)
    assert nb, 'no links[] in ' + a
    src = src[:sp[0]] + nb + src[sp[1]:]

sp = block_span(src, TARGET)
b = src[sp[0]:sp[1]]
nb = patch_gate(b, BADGES)
assert nb, 'no gate slot'
src = src[:sp[0]] + nb + src[sp[1]:]

with io.open(FP, 'w', encoding='utf-8') as f:
    f.write(src)
print('linked %s <-> %s, requiresBadges=%d' % (ANCHOR, TARGET, BADGES))