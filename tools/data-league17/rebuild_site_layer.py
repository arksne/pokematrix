# -*- coding: utf-8 -*-
"""Rebuild moves_db.json site layer: fix RU type nouns, backfill egg/tutor-only
moves from attacks_raw.json (PP/Type/Power/Accuracy/Priority).

Keeps fx skeletons from moves_db.progress.json (no refetch).
Run: python rebuild_site_layer.py
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

TYPE_RU = {
    'Нормальный': 'normal', 'Огненный': 'fire', 'Водный': 'water',
    'Электрический': 'electric', 'Травяной': 'grass', 'Ледяной': 'ice',
    'Боевой': 'fighting', 'Ядовитый': 'poison', 'Земляной': 'ground',
    'Летающий': 'flying', 'Психический': 'psychic', 'Насекомый': 'bug',
    'Каменный': 'rock', 'Призрак': 'ghost', 'Драконий': 'dragon',
    'Тёмный': 'dark', 'Стальной': 'steel', 'Волшебный': 'fairy',
    'Стеллар': 'stellar',
    # формы-существительные и опечатки, встречающиеся на страницах атак:
    'Дракон': 'dragon', 'Камень': 'rock', 'Каменый': 'rock',
    'Насекомое': 'bug', 'Тёмный': 'dark',
}
CAT_RU = {'Физическая': 'physical', 'Специальная': 'special', 'Статусная': 'status'}


def load(p):
    with io.open(os.path.join(HERE, p), encoding='utf-8') as f:
        return json.load(f)


def save(p, obj):
    with io.open(os.path.join(HERE, p), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False)


def num(x):
    x = (x or '').strip()
    if x in ('', '—', '-', '–', '∞'):
        return None
    m = re.search(r'\d+', x)
    return int(m.group()) if m else None


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', (name or '').lower()).strip('-')


def parse_attack_pages(raw):
    """english_name -> {pp, type_ru, cat_ru, power, acc, prio, desc_ru}.

    Заголовок у всех страниц одинаковый («Информация по атаке»), английское
    имя — первая латинская ячейка после него: | |Double Slap| |.
    """
    out = {}
    for v in raw.values():
        text = v.get('text') or ''
        if not text:
            continue
        m = re.search(r'\|\s*\|\s*([A-Z][A-Za-z\- \'.é]+?)\s*\|\s*\|', text)
        if not m:
            continue
        name = m.group(1).strip()
        fields = dict(re.findall(r'\|\|\|([^|:]{1,20}):\|\|\|([^|]*)', text))
        if 'PP' not in fields:
            continue
        raw_typ = (fields.get('Тип') or '').strip()
        toks = raw_typ.split('(')[0].strip().split()
        cat2 = ''
        pm = re.search(r'\(([^)]+)\)', raw_typ)
        if pm:
            for tok in re.split(r'[,\s]+', pm.group(1)):
                if tok in ('Физический', 'Специальный', 'Статусный'):
                    cat2 = tok
                    break
        desc = ''
        dm = re.search(r'Описание:\|\|\|(.{20,600}?)(\|\|\||$)', text, re.S)
        if dm:
            desc = re.sub(r'\s+', ' ', dm.group(1)).strip()
            desc = re.sub(r'[\|\[\]{}]', '', desc).strip()[:400]
        out[name] = {
            'pp': num(fields.get('PP', '')),
            'type_ru': toks[0] if toks else '',
            'cat_ru': cat2,
            'power': num(fields.get('Мощность', '')),
            'acc': num((fields.get('Точность', '') or '').replace('%', '')),
            'prio': num(fields.get('Приоритет', '')),
            'desc_ru': desc or None,
        }
    return out


def main():
    moves = load('moves.json')
    prog = load('moves_db.progress.json')
    try:
        raw = load('attacks_raw.json')
    except FileNotFoundError:
        raw = {}
    pages = parse_attack_pages(raw)
    print('attack pages parsed:', len(pages))

    fx_by_slug = {s: v.get('fx') for s, v in prog.items()}
    db = {}
    gaps = []
    for name, tab in moves.items():
        s = slug(name)
        pg = pages.get(name, {})
        type_ru = tab.get('type') if isinstance(tab.get('type'), str) and \
            any(ord(c) > 127 for c in tab.get('type')) else None
        if not type_ru:
            type_ru = pg.get('type_ru') or ''
        type_en = TYPE_RU.get((type_ru or '').strip(), tab.get('type')
                              if isinstance(tab.get('type'), str)
                              and tab.get('type') in TYPE_RU.values() else None)
        cat = tab.get('cat') if tab.get('cat') in ('physical', 'special', 'status') else None
        if not cat:
            cat = CAT_RU.get(pg.get('cat_ru') or '')
        fx = fx_by_slug.get(s)
        if not cat and fx and isinstance(fx.get('damage_class'), dict):
            cat = fx['damage_class'].get('name')
        site = {
            'type': type_en,
            'cat': cat,
            'power': tab.get('power') if tab.get('power') is not None else pg.get('power'),
            'acc': tab.get('acc') if tab.get('acc') is not None else pg.get('acc'),
            'pp': tab.get('pp') if tab.get('pp') is not None else pg.get('pp'),
        }
        # Статусным мощность/точность не положены (прочерк на сайте), переменная
        # мощность (Flail/Counter/...) и всегда-попадание (Swift/Aura Sphere/...)
        # на сайте тоже прочерк — движок трактует null как в PokeAPI. Гэп —
        # только отсутствие типа/категории/PP.
        if site['type'] is None or site['cat'] is None or site['pp'] is None:
            gaps.append((s, site))
        desc = pg.get('desc_ru') or prog.get(s, {}).get('desc_ru')
        db[s] = {'site': site, 'fx': fx, 'desc_ru': desc}
    save('moves_db.json', db)
    print('saved:', len(db), '| gaps:', len(gaps))
    for s, site in gaps[:30]:
        print('  GAP:', s, site)


if __name__ == '__main__':
    main()
