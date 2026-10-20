# -*- coding: utf-8 -*-
"""Wire the disconnected location groups back into the map + badge gates.

Аудит: 47 локаций были отрезаны НУЛЁМ связей с достижимой картой — весь
архипелаг Sevii, Грёзное Ущелье, Сафари-зона Джото, каньон Севолт и зона
блуждания. Контент (энкаунтеры, NPC, точки квестов) был недостижим целиком.

Связи по канону:
  oneIsland      <-> palletTown      (Олеана/парс от Паллет)
  liptooChamber  <-> burnedTower     (Грёзное Ущелье под башней)
  route47        <-> route43         (заповедник с 43-го маршрута)
  canyonEntrance <-> route42         (каньон у Вайолета)
  roamingJohto   <-> blackthornCity  (роуминг = пост-игровые легендарки)
  fourIsland     <-> threeIslePort   (паром между островами Sevii)

Гейт по значкам (контент поздний):
  Sevii Islands 16, Safari Zone 12, Грёзное Ущелье 11, каньон 10, роуминг 16.
"""
import io
import re

FP = r'C:\Users\ARK\pokematrix\src\data\regions.ts'

# (локация-якорь, целевая, гейт-значки)
LINKS = [
    ('palletTown',     'oneIsland',      16),
    ('burnedTower',    'liptooChamber',  11),
    ('route43',        'route47',        12),
    ('route42',        'canyonEntrance', 10),
    ('blackthornCity', 'roamingJohto',   16),
    ('threeIslePort',  'fourIsland',     16),
]


def block_span(src, loc):
    """Границы блока локации в исходнике (по балансу скобок)."""
    m = re.search(r'^[ ]{6}' + re.escape(loc) + r':\s*\{', src, re.M)
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
    """Дописать связь ВНУТРЬ массива links:[...] (с запятой)."""
    m = re.search(r"links:\s*\[", block)
    if not m:
        return None
    # ищем закрывающую скобку массива
    depth = 1
    i = m.end()
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
    """Добавить requiresBadges в блок локации (если ещё нет)."""
    if 'requiresBadges:' in block:
        return block
    m = re.search(r'\n([ ]{8})(hasWater|hasHeal|encounters):', block)
    if not m:
        m = re.search(r'\n([ ]{8})\w+:', block)
    if m:
        indent = m.group(1)
        return block[:m.start()] + '\n%srequiresBadges: %d,' % (indent, badges) + block[m.start():]
    return None


def main():
    with io.open(FP, encoding='utf-8') as f:
        src = f.read()

    for anchor, target, badges in LINKS:
        # anchor -> target
        sp = block_span(src, anchor)
        assert sp, 'no block for ' + anchor
        b = src[sp[0]:sp[1]]
        nb = patch_links(b, target)
        assert nb, 'no links[] in ' + anchor
        src = src[:sp[0]] + nb + src[sp[1]:]

        # target -> anchor
        sp = block_span(src, target)
        assert sp, 'no block for ' + target
        b = src[sp[0]:sp[1]]
        nb = patch_links(b, anchor)
        assert nb, 'no links[] in ' + target
        src = src[:sp[0]] + nb + src[sp[1]:]

        # гейт на целевой
        sp = block_span(src, target)
        b = src[sp[0]:sp[1]]
        nb = patch_gate(b, badges)
        assert nb, 'no gate slot in ' + target
        src = src[:sp[0]] + nb + src[sp[1]:]

        print('linked %-18s <-> %-16s requiresBadges=%d' % (anchor, target, badges))

    with io.open(FP, 'w', encoding='utf-8') as f:
        f.write(src)
    print('regions.ts updated')


if __name__ == '__main__':
    main()