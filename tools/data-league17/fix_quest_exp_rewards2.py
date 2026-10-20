# -*- coding: utf-8 -*-
"""Починить награды квестов после удаления конфет опыта.

Мы заменили expCandy* на rareCandy, но rareCandy стоит 800 000 — «продаваемость
наград» тира (лимит 150k) взорвалась. Берём исходные строки из git и
подставляем предмет сопоставимой цены:

  expCandyXs (20)    -> antidote      (200)
  expCandyS  (240)   -> paralyzeHeal (200)
  expCandyM  (1000)  -> superPotion  (700)
  expCandyL  (3000)  -> revive      (2000)
  expCandyXl (10000) -> hyperPotion (1500)
  expShare   (25000) -> sacredAsh  (50000)
"""
import io
import re
import subprocess

ROOT = r'C:\Users\ARK\pokematrix'
REPL = {
    'expCandyXs': 'antidote',
    'expCandyS': 'paralyzeHeal',
    'expCandyM': 'superPotion',
    'expCandyL': 'revive',
    'expCandyXl': 'hyperPotion',
    'expShare': 'sacredAsh',
}

FILES = ['src/data/npc.ts', 'src/data/npc-packs/kanto-1.ts', 'src/data/npc-packs/kanto-2.ts',
         'src/data/npc-packs/johto-1.ts', 'src/data/npc-packs/johto-2.ts']

for rel in FILES:
    path = ROOT + '\\' + rel.replace('/', '\\')
    try:
        orig = subprocess.check_output(
            ['git', 'show', 'HEAD:' + rel], cwd=ROOT, stderr=subprocess.DEVNULL).decode('utf-8')
    except subprocess.CalledProcessError:
        continue
    with io.open(path, encoding='utf-8') as f:
        cur = f.read()

    # строки оригинала, где была конфета опыта
    exp_lines = [l for l in orig.split('\n')
                 if re.search(r"expCandy\w*|expShare", l)]
    if not exp_lines:
        continue
    new = cur
    for line in exp_lines:
        for old, repl in REPL.items():
            if old not in line:
                continue
            # в оригинале: rewardItem: 'expCandyX' или id: 'expCandyX'
            for pat, rp in (("rewardItem: '%s'" % old, "rewardItem: '%s'" % repl),
                             ("id: '%s'" % old, "id: '%s'" % repl)):
                if pat in line:
                    # найти соответствующую строку в текущем файле (та же quest id)
                    qm = re.search(r"id: '([\w]+)'", line)
                    if qm:
                        # заменить ВСЕ вхождения rareCandy в строках с этим quest id
                        def fix(m, rp=rp, qid=qm.group(1)):
                            return m.group(0)
                        new = re.sub(
                            r"(\{ id: '%s'.*?\})" % re.escape(qm.group(1)),
                            lambda m: m.group(1).replace("'rareCandy'", "'%s'" % rp),
                            new, count=1, flags=re.S)
    if new != cur:
        with io.open(path, 'w', encoding='utf-8') as f:
            f.write(new)
        print('  %s: награды починены' % rel)