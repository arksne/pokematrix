import os
import re

def extract_block(filepath, var_name, out_path):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    pattern = r'(const|let|var)\s+' + var_name + r'\s*=\s*({|\[)'
    match = re.search(pattern, content)
    if not match:
        return False
        
    start_idx = match.start()
    brace_start = match.end() - 1
    
    open_braces = 0
    in_string = False
    string_char = ''
    escape = False
    end_idx = -1
    
    for i in range(brace_start, len(content)):
        c = content[i]
        if escape:
            escape = False
            continue
        if c == '\\':
            escape = True
            continue
        if in_string:
            if c == string_char:
                in_string = False
        else:
            if c in '"\'`':
                in_string = True
                string_char = c
            elif c == match.group(2):
                open_braces += 1
            elif c == ('}' if match.group(2) == '{' else ']'):
                open_braces -= 1
                if open_braces == 0:
                    end_idx = i + 1
                    break
                    
    if end_idx == -1:
        return False
        
    while end_idx < len(content) and content[end_idx] in ' \t\r\n;':
        if content[end_idx] == ';':
            end_idx += 1
            break
        end_idx += 1
        
    extracted = content[start_idx:end_idx]
    extracted = re.sub(r'^(const|let|var)\s+', 'export const ', extracted)
    
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(extracted)
        
    new_content = content[:start_idx] + content[end_idx:]
    import_stmt = f"import {{ {var_name} }} from './{out_path}';\n"
    
    if 'import { REGIONS }' in new_content:
        new_content = new_content.replace("import { REGIONS }", import_stmt + "import { REGIONS }", 1)
    else:
        new_content = import_stmt + new_content
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Extracted {var_name}")
    return True

extract_block('main.js', 'MONSTER_DROP_TABLE', 'src/data/drops.js')
extract_block('main.js', 'natures', 'src/data/natures.js')
extract_block('main.js', 'trainingStages', 'src/data/training.js')
extract_block('main.js', 'STONE_ITEM_MAP', 'src/data/stones.js')
extract_block('main.js', 'TRANSPORT_HUBS', 'src/data/transport.js')
