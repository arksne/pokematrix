# -*- coding: utf-8 -*-
"""fourIsland <-> threeIslePort: в каноне между ними паром.

Без этой связи остров был отрезан: fourIsland ссылался только на icefallCave,
а тот — обратно на fourIsland (петля в вакууме).
"""
import io
import re

FP = r'C:\Users\ARK\pokematrix\src\data\regions.ts'
A, B = 'fourIsland', 'threeIslePort'


def loc_block(src, loc):
    m = re.search(r'^[ ]{6}' + re.escape(loc) + r':\s*\{', src, re.M)
    if not m:
        return None, None, None
    start = m.start()
    depth = 0
    i = m.end() - 1
    while i < len(src):
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
            if depth == 0:
                break
        i += 1
    return start, i, src[start:i + 1]


def add_link(block, target):
    m = re.search(r"links:\s*\[([^\]]*)\]", block)
    if not m:
        return None
    inner = m.group(1).rstrip()
    if "'%s'" % target in inner:
        return block
    return block[:m.start(1)] + inner + (" " if inner else "") + "'%s'" % target + block[m.end(1):]


with io.open(FP, encoding='utf-8') as f:
    src = f.read()

for a, b in ((A, B), (B, A)):
    s, e, block = loc_block(src, a)
    assert block is not None, a
    nb = add_link(block, b)
    assert nb is not None, 'no links in ' + a
    src = src[:s] + nb + src[e:]
    print('linked %s <-> %s' % (a, b))

with io.open(FP, 'w', encoding='utf-8') as f:
    f.write(src)
print('ok')