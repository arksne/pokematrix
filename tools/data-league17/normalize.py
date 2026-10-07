"""Normalize raw league17 scrape into compact game tables."""
import io
import json
import os
import re

SRC = r'C:\Users\ARK\pokematrix\tools\data-league17'
OUT = SRC

TYPE_RU = {
    'Нормальный': 'normal', 'Огненный': 'fire', 'Водный': 'water',
    'Электрический': 'electric', 'Травяной': 'grass', 'Ледяной': 'ice',
    'Боевой': 'fighting', 'Ядовитый': 'poison', 'Земляной': 'ground',
    'Летающий': 'flying', 'Психический': 'psychic', 'Насекомый': 'bug',
    'Каменный': 'rock', 'Призрак': 'ghost', 'Драконий': 'dragon',
    'Тёмный': 'dark', 'Стальной': 'steel', 'Волшебный': 'fairy',
    'Стеллар': 'stellar',
}
CAT_RU = {'Физическая': 'physical', 'Специальная': 'special', 'Статусная': 'status'}


def num(x):
    x = (x or '').strip()
    if x in ('', '—', '-', '–', '∞'):
        return None
    m = re.search(r'\d+', x)
    return int(m.group()) if m else None


def main():
    pok = json.load(io.open(os.path.join(SRC, 'pokedex.json'), encoding='utf-8'))
    moves = {}
    species = {}
    for sp, v in pok.items():
        lvl = []
        for row in v['moves']['levelup']:
            try:
                lv = int(row[0])
            except (ValueError, IndexError):
                continue
            name = row[1]
            lvl.append([lv, name])
            moves.setdefault(name, {'type': row[2], 'cat': row[3],
                                    'power': num(row[4]), 'acc': num(row[5]),
                                    'pp': num(row[6])})
        tm = []
        for row in v['moves']['tm']:
            try:
                no = int(row[0])
            except (ValueError, IndexError):
                continue
            name = row[1]
            tm.append([no, name])
            moves.setdefault(name, {'type': row[2], 'cat': row[3],
                                    'power': num(row[4]), 'acc': num(row[5]),
                                    'pp': num(row[6])})
        egg = [r[1] for r in v['moves']['egg'] if len(r) > 1]
        tutor = [r[1] for r in v['moves']['tutor'] if len(r) > 1]
        for name in egg + tutor:
            moves.setdefault(name, {})
        species[sp] = {
            'name': v['name'],
            'stats': v['stats'],
            'abilities': v.get('abilities', []),
            'levelup': sorted(lvl),
            'tm': sorted(tm),
            'egg': egg,
            'tutor': tutor,
            'evo': v.get('evo_raw', ''),
        }
    # normalize type/category to english codes
    for m, d in moves.items():
        if 'type' in d:
            d['type'] = TYPE_RU.get(d['type'], d['type'])
        if 'cat' in d:
            d['cat'] = CAT_RU.get(d['cat'], d['cat'])
    io.open(os.path.join(OUT, 'moves.json'), 'w', encoding='utf-8').write(
        json.dumps(moves, ensure_ascii=False))
    io.open(os.path.join(OUT, 'species.json'), 'w', encoding='utf-8').write(
        json.dumps(species, ensure_ascii=False))
    print('moves:', len(moves), 'species:', len(species))
    for f in ('moves.json', 'species.json'):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')


if __name__ == '__main__':
    main()
