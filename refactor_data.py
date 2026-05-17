import os
import re

def extract_block(filepath, var_name, out_path):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the start of the variable
    pattern = r'(const|let|var)\s+' + var_name + r'\s*=\s*({|\[)'
    match = re.search(pattern, content)
    if not match:
        print(f"Could not find {var_name}")
        return False
        
    start_idx = match.start()
    brace_start = match.end() - 1
    
    # Brace matching
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
            elif c == match.group(2): # { or [
                open_braces += 1
            elif c == ('}' if match.group(2) == '{' else ']'):
                open_braces -= 1
                if open_braces == 0:
                    end_idx = i + 1
                    break
                    
    if end_idx == -1:
        print(f"Could not find end of {var_name}")
        return False
        
    # include trailing semicolon if present
    while end_idx < len(content) and content[end_idx] in ' \t\r\n;':
        if content[end_idx] == ';':
            end_idx += 1
            break
        end_idx += 1
        
    extracted = content[start_idx:end_idx]
    
    # replace 'const VAR =' with 'export const VAR ='
    extracted = re.sub(r'^(const|let|var)\s+', 'export const ', extracted)
    
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(extracted)
        
    # Replace in original file
    new_content = content[:start_idx] + content[end_idx:]
    
    # Add import at the top
    import_stmt = f"import {{ {var_name} }} from './{out_path}';\n"
    
    # insert import right after 'import { io } from 'socket.io-client';'
    if 'socket.io-client' in new_content:
        new_content = new_content.replace("import { io } from 'socket.io-client';", "import { io } from 'socket.io-client';\n" + import_stmt, 1)
    else:
        new_content = import_stmt + new_content
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Successfully extracted {var_name} to {out_path}")
    return True

extract_block('main.js', 'REGIONS', 'src/data/regions.js')
extract_block('main.js', 'NPC_DATA', 'src/data/npc.js')
extract_block('main.js', 'ITEMS', 'src/data/items.js')
extract_block('main.js', 'gymLeaders', 'src/data/gyms.js')
extract_block('main.js', 'ADMIN_USERNAMES', 'src/data/admin.js')
extract_block('main.js', 'GEN_STARTERS', 'src/data/starters.js')
