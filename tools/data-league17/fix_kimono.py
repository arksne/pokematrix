# -*- coding: utf-8 -*-
"""ecr_kimono: «Победи 40 диких сестёр кимоно» -> «Собери 40 сестёр кимоно».

defeat_x считает ТОЛЬКО победы над дикими. В природе спавнится лишь Вапореон;
Джолтеон/Флареон/Эспеон/Умбреон берутся камнями, и победить их дикими
невозможно — квест был невыполним принципиально.

Решение: паттерн bla_hoard — type:'special' + verify.typeSpecies + typeCount.
typeCount считает ПОЙМАННЫХ, поэтому эволюции с камней тоже идут в зачёт,
и тема «пяти стихий» сохраняется.
"""
import io
import re

FP = r'C:\Users\ARK\pokematrix\src\data\npc-packs\johto-1.ts'

NEW = """{ id: 'ecr_kimono', type: 'special', targetItem: null, targetQty: 1, desc: 'Собери 40 сестёр кимоно: Вапореон, Джолтеон, Флареон, Эспеон, Умбреон (танец пяти стихий!)', rewardMoney: 60000, rewardItem: 'premierBall', rewardQty: 6, prereqQuest: null, verify: { typeSpecies: ['vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon'], typeCount: 40 } }"""

with io.open(FP, encoding='utf-8') as f:
    src = f.read()

# находим весь объект квеста от id: 'ecr_kimono' до закрывающей скобки
m = re.search(r"\{ id: 'ecr_kimono'.*?\},\s*\n", src, re.S)
assert m, 'ecr_kimono block not found'
old = m.group(0)
src = src[:m.start()] + NEW + ',\n' + src[m.end():]

with io.open(FP, 'w', encoding='utf-8') as f:
    f.write(src)
print('OLD:', old.strip()[:120])
print('NEW:', NEW[:120])