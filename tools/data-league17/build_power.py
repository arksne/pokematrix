# -*- coding: utf-8 -*-
"""Build public/pokemon_power.json: {species: bst} from tools/data-league17/species.json.

Source of truth for POWER (base stat total) per species. Used by:
  - rarity of wild spawns (stronger species must be rarer),
  - power stars / rarity stars in the dex and profile.

Levels: computed as HP + Atk + Def + Spe + SpA + SpD.
Keys: lowercase species name, forms kept as-is ('kabuto-legacy' -> own BST).
"""
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'species.json')
DST = os.path.join(ROOT, 'public', 'pokemon_power.json')

STAT_KEYS = ('HP', 'Atk', 'Def', 'Spe', 'SpA', 'SpD')


def main():
    with io.open(SRC, encoding='utf-8') as f:
        species = json.load(f)

    out = {}
    for v in species.values():
        name = (v.get('name') or '').strip()
        st = v.get('stats') or {}
        if not name or not st:
            continue
        vals = [int(st[k]) for k in STAT_KEYS if isinstance(st.get(k), (int, float))]
        if len(vals) != len(STAT_KEYS):
            continue
        out[name.lower()] = sum(vals)

    if not os.path.isdir(os.path.dirname(DST)):
        os.makedirs(os.path.dirname(DST))

    with io.open(DST, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'), sort_keys=True, ensure_ascii=False)

    print('species:', len(out))
    print('size KB:', os.path.getsize(DST) // 1024)
    bsts = sorted(out.values())
    print('bst min/median/max:', bsts[0], bsts[len(bsts) // 2], bsts[-1])
    for probe in ('bulbasaur', 'kabuto', 'kabuto-legacy', 'rapidash', 'mewtwo'):
        print(' ', probe, '->', out.get(probe))


if __name__ == '__main__':
    main()