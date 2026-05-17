import re

with open('main.js', 'r') as f:
    lines = f.readlines()

blocks = {}
current_block = None
count = 0

for i, line in enumerate(lines):
    match = re.match(r'^(const|let|var|function)\s+([A-Za-z0-9_]+)', line)
    if match:
        if current_block:
            blocks[current_block] = count
        current_block = match.group(2)
        count = 1
    elif current_block:
        count += 1

if current_block:
    blocks[current_block] = count

sorted_blocks = sorted(blocks.items(), key=lambda x: x[1], reverse=True)
for name, lines in sorted_blocks[:20]:
    print(f"{name}: {lines} lines")
