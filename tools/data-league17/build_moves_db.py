"""Build moves_db.json: site numbers (power/acc/pp/type/cat) + PokeAPI effect skeleton.

Source:  moves.json (site scrape) + attacks_raw.json (RU descriptions)
          + live PokeAPI /move/{slug} (effect structure only, one-time fetch).
Output: moves_db.json {slug: {site: {...}, fx: {...}|None, desc_ru: str|None}}

Resumable: progress cached in moves_db.progress.json (slugs already fetched).
Run: python build_moves_db.py
"""
import io
import json
import os
import re
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
POKEAPI = 'https://pokeapi.co/api/v2/move/{}'

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

FX_KEYS = ('priority', 'target', 'stat_changes', 'meta',
           'effect_chance', 'damage_class')


def slug(name):
    s = (name or '').lower()
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s


def load(p):
    with io.open(os.path.join(HERE, p), encoding='utf-8') as f:
        return json.load(f)


def save(p, obj):
    with io.open(os.path.join(HERE, p), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False)


def fetch_poke_move(slug_name):
    req = urllib.request.Request(POKEAPI.format(slug_name),
                                 headers={'User-Agent': 'pokematrix-databuild/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            d = json.load(r)
    except Exception as e:
        return None, str(e)
    fx = {k: d.get(k) for k in FX_KEYS}
    return fx, None


def extract_desc(text):
    # attacks_raw text is wiki markup; best-effort Russian description slice
    if not text:
        return None
    m = re.search(r'Описание:(.{20,600}?)(\|\|\||$)', text, re.S)
    if not m:
        return None
    desc = re.sub(r'\s+', ' ', m.group(1)).strip()
    desc = re.sub(r'[\|\[\]{}]', '', desc).strip()
    return desc[:400] or None


def main():
    moves = load('moves.json')
    try:
        raw = load('attacks_raw.json')
    except FileNotFoundError:
        raw = {}
    desc_by_title = {}
    for v in raw.values():
        t = (v.get('title') or '').strip()
        if t:
            desc_by_title[t] = extract_desc(v.get('text', ''))

    prog_p = os.path.join(HERE, 'moves_db.progress.json')
    if os.path.exists(prog_p):
        db = load('moves_db.progress.json')
    else:
        db = {}

    names = sorted(moves.keys())
    todo = [n for n in names if slug(n) not in db]
    print('total:', len(names), 'todo:', len(todo))
    fails = []
    for i, name in enumerate(todo):
        s = slug(name)
        fx, err = fetch_poke_move(s)
        if fx is None:
            fails.append((name, err))
            db[s] = {'site': moves[name], 'fx': None,
                     'desc_ru': desc_by_title.get(name)}
        else:
            db[s] = {'site': moves[name], 'fx': fx,
                     'desc_ru': desc_by_title.get(name)}
        if (i + 1) % 25 == 0:
            save('moves_db.progress.json', db)
            print('...{}/{}'.format(i + 1, len(todo)))
        time.sleep(0.15)
    save('moves_db.progress.json', db)
    save('moves_db.json', db)
    nofx = [k for k, v in db.items() if not v.get('fx')]
    print('saved moves_db.json:', len(db), '| without fx:', len(nofx))
    for k in nofx:
        print('  NOFX:', k)
    if fails:
        print('fetch fails:', len(fails))


if __name__ == '__main__':
    main()
