"""League17 Reborn wiki scraper -> tools/data-league17/*.json (utf-8).
Usage: python scrape.py [pokedex|attacks|items|all]
Polite: 0.25s between requests.
"""
import io
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

BASE = 'https://league17reborn.ru'
WIKI = 'http://wiki.league17reborn.ru'
OUT = r'C:\Users\ARK\pokematrix\tools\data-league17'
UA = {'User-Agent': 'pokematrix-research/1.0 (contact: dev)'}


def get(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
            try:
                return raw.decode('windows-1251')
            except Exception:
                return raw.decode('utf-8', errors='replace')
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(1.5)
    raise RuntimeError('unreachable')


def clean(s):
    s = re.sub(r'<script.*?</script>', '', s, flags=re.S)
    s = re.sub(r'<style.*?</style>', '', s, flags=re.S)
    return s


def cells(row_html):
    parts = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row_html, re.S)
    out = []
    for c in parts:
        t = re.sub(r'<[^>]+>', '', c)
        t = re.sub(r'\s+', ' ', t).strip()
        out.append(t)
    return out


def scrape_pokedex():
    html = get(BASE + '/pokedex.php?all')
    html = clean(html)
    ids = sorted(set(re.findall(r'pokedex\.php\?sp_id=([\d.]+)', html)),
                 key=lambda x: [int(p) for p in x.split('.')])
    print('sp_ids found:', len(ids), flush=True)
    data = {}
    for n, sp in enumerate(ids):
        try:
            h = clean(get(BASE + '/pokedex.php?sp_id=' + sp))
        except Exception as e:
            print('FAIL page', sp, str(e)[:80], flush=True)
            continue
        name_m = re.search(r'<div class="poke-name">#([\d.]+)\s+([^<]+)</div>', h)
        name = name_m.group(2).strip() if name_m else ''
        # stats block
        stats = {}
        for st, val in re.findall(
                r'<div>(HP|Atk|Def|Spe|SpA|SpD)\s*<b>(\d+)</b></div>', h):
            stats[st] = int(val)
        # abilities
        abil = re.findall(
            r'<span class="ability-name">.*?([\u0410-\u044fA-Za-z \-]+?)\s*</span>\s*<span class="ability-label">([^<]+)</span>',
            h)
        abilities = [{'name': a.strip(), 'kind': b.strip()} for a, b in abil]
        # gender
        gender = {}
        gm = re.search(r'(\d+)%[^%]*?(\d+)%', h)
        # attack tables: each poke-data-tab table in order Развитие, ТМ, Разведение, Обучение
        tabs = re.findall(
            r'<div class="poke-data-tab[^"]*"[^>]*>(.*?)</div>\s*(?=<div class="poke-data-tab|<div class="poke-tab|$)',
            h, re.S)
        # fallback: split by tab headers
        attack_tabs = {'levelup': [], 'tm': [], 'egg': [], 'tutor': []}
        # find all tables with move header row (order: levelup, tm, egg, tutor)
        tables = re.findall(r'<table[^>]*>(.*?)</table>', h, re.S)
        move_tables = [t for t in tables if 'Мощность' in t and 'Атака' in t][:4]
        # order on page: levelup, tm, egg(breeding), tutor
        keys = ['levelup', 'tm', 'egg', 'tutor']
        for k, t in zip(keys, move_tables):
            for row in re.findall(r'<tr>(.*?)</tr>', t, re.S):
                if '<th' in row:
                    continue
                c = cells(row)
                if len(c) >= 7 and c[0] not in ('Уровень', 'TM', ''):
                    attack_tabs[k].append(c[:7])
        # evolutions block: links + method text near evo-block
        evo_m = re.search(r'id="evo-block"(.*?)id="forms-block"', h, re.S)
        evo_text = ''
        if evo_m:
            evo_text = re.sub(r'<[^>]+>', ' ', evo_m.group(1))
            evo_text = re.sub(r'\s+', ' ', evo_text).strip()[:600]
        data[sp] = {'name': name, 'stats': stats, 'abilities': abilities,
                    'moves': attack_tabs, 'evo_raw': evo_text}
        if (n + 1) % 100 == 0:
            print('...%d/%d' % (n + 1, len(ids)), flush=True)
        time.sleep(0.25)
    return data


def scrape_attacks():
    html = clean(get(WIKI + '/index.php/%D0%9A%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D1%8F:%D0%90%D1%82%D0%B0%D0%BA%D0%B4%D0%B5%D0%BA%D1%81'))
    ids = sorted(set(int(x) for x in re.findall(r'at_view\.php\?AttackID=(\d+)', html)))
    print('attack ids found:', len(ids), flush=True)
    data = {}
    for n, aid in enumerate(ids):
        try:
            h = clean(get('https://league17reborn.ru/at_view.php?AttackID=%d' % aid))
        except Exception as e:
            print('FAIL attack', aid, str(e)[:80], flush=True)
            continue
        text = re.sub(r'<[^>]+>', '|', h)
        text = re.sub(r'\s+', ' ', text)
        # name from title
        nm = re.search(r'<TITLE>(.*?)</TITLE>', h, re.I)
        data[str(aid)] = {'title': nm.group(1).strip() if nm else '',
                          'text': text.strip()[:3000]}
        if (n + 1) % 100 == 0:
            print('...%d/%d' % (n + 1, len(ids)), flush=True)
        time.sleep(0.25)
    return data


ITEM_CATS = {
    'balls': '%D0%9F%D0%BE%D0%BA%D0%B5%D0%B1%D0%BE%D0%BB%D1%8B',
    'regen': '%D0%A0%D0%B5%D0%B3%D0%B5%D0%BD%D0%B5%D1%80%D0%B0%D1%82%D0%BE%D1%80%D1%8B',
    'modifiers': '%D0%9C%D0%BE%D0%B4%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%82%D0%BE%D1%80%D1%8B',
    'battle': '%D0%91%D0%BE%D0%B5%D0%B2%D1%8B%D0%B5',
    'evolvers': '%D0%AD%D0%B2%D0%BE%D0%BB%D1%8C%D0%B2%D0%B5%D1%80%D1%8B',
    'quest': '%D0%9A%D0%B2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D1%8B%D0%B5',
    'tickets': '%D0%91%D0%B8%D0%BB%D0%B5%D1%82%D1%8B',
    'rewards': '%D0%9D%D0%B0%D0%B3%D1%80%D0%B0%D0%B4%D1%8B',
    'other': '%D0%9F%D1%80%D0%BE%D1%87%D0%B5%D0%B5',
    'tm_attacks': '%D0%9A%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D1%8F:%D0%A2%D0%9C-%D0%B0%D1%82%D0%B0%D0%BA%D0%B8',
    'potions': '%D0%97%D0%B5%D0%BB%D1%8C%D1%8F',
    'craft': '%D0%A0%D0%B5%D0%BC%D0%B5%D1%81%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B5',
    'artifacts': '%D0%90%D1%80%D1%82%D0%B5%D1%84%D0%B0%D0%BA%D1%82%D1%8B',
}


def scrape_items():
    data = {}
    for cat, slug in ITEM_CATS.items():
        try:
            h = clean(get(WIKI + '/index.php/' + slug))
        except Exception as e:
            print('FAIL cat', cat, str(e)[:80], flush=True)
            continue
        rows = []
        for t in re.findall(r'<table[^>]*>(.*?)</table>', h, re.S):
            for row in re.findall(r'<tr>(.*?)</tr>', t, re.S):
                c = cells(row)
                if c and not re.match(r'^(#|Название|Название )', c[0]):
                    rows.append(c)
        data[cat] = rows
        print(cat, 'rows:', len(rows), flush=True)
        time.sleep(0.25)
    return data


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if which in ('pokedex', 'all'):
        d = scrape_pokedex()
        io.open(os.path.join(OUT, 'pokedex.json'), 'w', encoding='utf-8').write(
            json.dumps(d, ensure_ascii=False))
        print('pokedex saved:', len(d))
    if which in ('attacks', 'all'):
        d = scrape_attacks()
        io.open(os.path.join(OUT, 'attacks_raw.json'), 'w', encoding='utf-8').write(
            json.dumps(d, ensure_ascii=False))
        print('attacks saved:', len(d))
    if which in ('items', 'all'):
        d = scrape_items()
        io.open(os.path.join(OUT, 'items_raw.json'), 'w', encoding='utf-8').write(
            json.dumps(d, ensure_ascii=False))
        print('items saved:', len(d))
