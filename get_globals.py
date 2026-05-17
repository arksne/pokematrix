import re

with open('main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

globals_list = []
for line in lines[:500]: # Check first 500 lines for global declarations
    if 'function' in line and not line.strip().startswith('//'): 
        pass # Stop reading at functions? Actually there might be let after. We'll just regex
    
    match = re.match(r'^(let|var)\s+([a-zA-Z0-9_]+)\s*(?:=\s*(.*?))?;', line)
    if match:
        globals_list.append((match.group(2), match.group(3)))

for name, val in globals_list:
    print(f"{name} = {val}")

