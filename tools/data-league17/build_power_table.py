# -*- coding: utf-8 -*-
"""Generate src/data/pokemon-power-table.ts from public/pokemon_power.json.

Таблица силы вида нужна СИНХРОННО в горячем пути (вес появления) и должна
работать с первой секунды после загрузки игры. Загрузка по сети создавала
гонку: первые бои шли с пустой таблицей (все виды весили одинаково, и «редкие»
попадались так же часто, как обычные), плюс зависела от того, что статику
в деплое отдают. Теперь данные вшиты в бандл.
"""
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, 'public', 'pokemon_power.json')
DST = os.path.join(ROOT, 'src', 'data', 'pokemon-power-table.ts')

with io.open(SRC, encoding='utf-8') as f:
    data = json.load(f)

lines = [
    '// АВТОГЕНЕРИРОВАНЫЙ ФАЙЛ — не править руками.',
    '// Источник: tools/data-league17/build_power.py → public/pokemon_power.json',
    '// Сумма базовых статов (BST) каждого вида: используется для редкости',
    '// появления диких, звёзд силы и звёзд редкости.',
    '',
    'export const POKEMON_BST: Record<string, number> = {',
]
for name in sorted(data):
    lines.append("  '%s': %d," % (name, data[name]))
lines.append('};')
lines.append('')

with io.open(DST, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print('wrote %s (%d species, %d KB)'
      % (os.path.relpath(DST, ROOT), len(data), os.path.getsize(DST) // 1024))