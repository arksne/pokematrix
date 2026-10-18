# -*- coding: utf-8 -*-
"""Build public/pokemon_evo.json from tools/data-league17/species.json.

The `evo` field is an HTML blob like:
  "#001 Bulbasaur ? 16 lvl ? #002 Ivysaur ? 32 lvl ? #003 Venusaur"
  "#095 Onix ? ? #208 Steelix"
We parse it into {species: [{to, level, method}]}.

Why: the battle used evolution levels from PokeAPI `evolution_details`, where
`min_level` is sometimes null (varies per version group). A null min_level
means "evolves at ANY level", so wilds evolved the moment they were caught,
and the level shown in the dex did not match the level the game enforced.
The league site has canonical levels, so we take them as the source of truth.
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'species.json')
DST = os.path.join(ROOT, 'public', 'pokemon_evo.json')

# Разделитель в данных лиги — длинная стрелка U+27F6 (обычные → тоже встречаются)
ARROWS = '\u27f6\u2192\u2794\u27a1'
NAME_RE = re.compile(r'#?\s*\d*\s*([A-Z][A-Za-z0-9\-\']*)\s*$')
LEVEL = re.compile(r'(\d+)\s*lvl', re.I)


def parse_evo(blob: str):
    """Extract [{name, level}] chain entries.

    Layout: «#001 Bulbasaur ↰ 16 lvl ↰ #002 Ivysaur ↰ 32 lvl ↰ #003 Venusaur»
    The level token sits BETWEEN two names and describes the transition
    from the previous name to the next one.
    """
    if not blob:
        return []
    text = re.split(r'<div class="poke-data-tab', blob)[0]
    text = re.sub(r'^[^#]*?(?=#)', '', text)   # выкидываем атрибуты style=...
    parts = [p.strip() for p in re.split('[%s]' % ARROWS, text) if p.strip()]

    chain = []
    pending_level = None
    for part in parts:
        lm = LEVEL.search(part)
        if lm:
            pending_level = int(lm.group(1))
            continue
        nm = NAME_RE.search(part)
        if not nm:
            continue
        name = nm.group(1)
        if name.lower().startswith('mega'):
            continue
        chain.append({'name': name, 'level': pending_level})
        pending_level = None
    return chain


def main():
    with io.open(SRC, encoding='utf-8') as f:
        species = json.load(f)

    out = {}
    for v in species.values():
        name = (v.get('name') or '').strip()
        if not name:
            continue
        chain = parse_evo(v.get('evo') or '')
        if len(chain) < 2:
            continue
        # Ключ — КАЖДОЕ звено цепочки, не только база: нужна и «ivysaur→venusaur».
        # Оставляем только переходы с уровнем: каменные/прочие условия
        # обрабатываются отдельно (STONE_ITEM_MAP), а null-уровень означал бы
        # «эволюция на любом уровне» — ровно тот баг, который чиним.
        for i in range(len(chain) - 1):
            level = chain[i + 1]['level']
            if level is None:
                continue
            src = chain[i]['name'].lower()
            dst = chain[i + 1]['name'].lower()
            out.setdefault(src, [])
            if not any(e['to'] == dst for e in out[src]):
                out[src].append({'to': dst, 'level': level})

    if not os.path.isdir(os.path.dirname(DST)):
        os.makedirs(os.path.dirname(DST))
    with io.open(DST, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'), sort_keys=True, ensure_ascii=False)

    print('species with evolution chain:', len(out))
    print('size KB:', os.path.getsize(DST) // 1024)
    for probe in ('bulbasaur', 'geodude', 'rattata', 'kabuto', 'abra', 'onix'):
        print(' ', probe, '->', out.get(probe))


if __name__ == '__main__':
    main()