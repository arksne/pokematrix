# -*- coding: utf-8 -*-
"""Build learnsets.json from species.json: {name_lower: {levelup, egg, tm, tutor}}.

levelup: [[lvl, name]] sorted, tm: [[no, name]] sorted, egg/tutor: [name].
Run: python build_learnsets.py
"""
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    with io.open(os.path.join(HERE, 'species.json'), encoding='utf-8') as f:
        species = json.load(f)
    out = {}
    for sp, v in species.items():
        key = (v.get('name') or '').lower()
        if not key:
            continue
        lvl = sorted([x for x in v.get('levelup', []) if len(x) == 2],
                     key=lambda x: (x[0], x[1]))
        tm = sorted([x for x in v.get('tm', []) if len(x) == 2],
                    key=lambda x: (x[0], x[1]))
        out[key] = {
            'levelup': lvl,
            'egg': v.get('egg', []),
            'tm': tm,
            'tutor': v.get('tutor', []),
        }
    with io.open(os.path.join(HERE, 'learnsets.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print('learnsets:', len(out))
    print('size KB:', os.path.getsize(os.path.join(HERE, 'learnsets.json')) // 1024)
    # sanity: TM numbers consistent across species?
    num2names = {}
    for v in out.values():
        for no, nm in v['tm']:
            num2names.setdefault(no, set()).add(nm)
    clash = {n: s for n, s in num2names.items() if len(s) > 1}
    print('tm numbers:', len(num2names), '| clashes:', len(clash))
    for n, s in sorted(clash.items())[:10]:
        print('  TM%02d ->' % n, sorted(s))


if __name__ == '__main__':
    main()
