import re

with open('main.js', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
lets = []
for line in lines:
    if line.startswith('let '):
        match = re.match(r'^let\s+([a-zA-Z0-9_]+)', line)
        if match:
            lets.append(match.group(1))

print("Found lets:", lets)
