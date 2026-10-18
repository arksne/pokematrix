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

# Виды, которых нет в species.json, но они реально встречаются в игре.
# Без них они падали бы в дефолтный вес 1.0 и вели себя как «обычные» —
# то есть легендарные формы становились частыми.
# Значения — канонические BST.
OVERRIDES = {
    'nidoran-f': 55 + 47 + 52 + 40 + 40 + 41,   # 275
    'nidoran-m': 46 + 57 + 40 + 40 + 40 + 50,   # 273
    'farfetchd': 52 + 65 + 55 + 58 + 50 + 60,   # 340
    'mr-mime': 40 + 45 + 65 + 100 + 120 + 90,    # 460
    'burmy': 40 + 19 + 20 + 19 + 20 + 20,        # 138
    'deoxys-normal': 50 + 150 + 50 + 150 + 50 + 90,   # 540
    'deoxys-attack': 50 + 150 + 90 + 180 + 90 + 150,
    'deoxys-defense': 50 + 90 + 180 + 90 + 180 + 90,
    'deoxys-speed': 50 + 180 + 20 + 180 + 20 + 150,
    'giratina-altered': 150 + 100 + 120 + 100 + 120 + 90,
    'shaymin-sky': 100 + 100 + 100 + 100 + 100 + 100,
    'giratina-origin': 150 + 120 + 100 + 120 + 100 + 90,
    'necrozma-mega': 97 + 167 + 97 + 167 + 97 + 129,
}


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

    # Добираем виды, которых нет в species.json
    for key, bst_value in OVERRIDES.items():
        out.setdefault(key, bst_value)

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