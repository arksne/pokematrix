import os
import re

with open('main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def get_block(start_marker, end_marker_func):
    start = -1
    end = -1
    for i, line in enumerate(lines):
        if start == -1 and start_marker in line:
            start = i
        if start != -1 and end_marker_func(i, line):
            end = i
            break
    if start == -1 or end == -1:
        return -1, -1, ""
    return start, end, "".join(lines[start:end+1])

def safe_check(i, offset, text):
    if i + offset < len(lines):
        return text in lines[i + offset]
    return False

# 1. Evolution
s_evo, e_evo, evo_block = get_block('// FEATURE: EVOLUTION', lambda i, l: safe_check(i, 2, 'function updateTimeOfDay()'))
# 2. Level Up Moves
s_lvl, e_lvl, lvl_block = get_block('// FEATURE: LEVEL-UP MOVE LEARNING', lambda i, l: safe_check(i, 2, 'FEATURE: TM MOVE RELEARNER'))
# 3. TM Relearner
s_tm, e_tm, tm_block = get_block('// FEATURE: TM MOVE RELEARNER', lambda i, l: safe_check(i, 2, 'FEATURE: SELL ITEMS'))
# 4. Nickname
s_nick, e_nick, nick_block = get_block('// FEATURE: NICKNAME', lambda i, l: safe_check(i, 2, 'FEATURE: CHAT SYSTEM'))

if s_evo == -1 or s_lvl == -1 or s_tm == -1 or s_nick == -1:
    print("Error finding blocks:")
    print("Evo:", s_evo, e_evo)
    print("Lvl:", s_lvl, e_lvl)
    print("Tm:", s_tm, e_tm)
    print("Nick:", s_nick, e_nick)
    exit(1)

os.makedirs('src/ui', exist_ok=True)

# ================= EVOLUTION =================
evo_content = evo_block
evo_content = evo_content.replace('function checkEvolution', 'export async function checkEvolution')
evo_content = evo_content.replace('function triggerEvolution', 'export async function triggerEvolution')
evo_content = evo_content.replace('async function fetchEvolutionChain', 'export async function fetchEvolutionChain')
evo_imports = """import { getPowerStars, getTypeGradient, evolutionCache, evolvesFromMap } from '../../main.js';
import { STONE_ITEM_MAP } from '../data/stones.js';\n\n"""
with open('src/ui/evolution.js', 'w', encoding='utf-8') as f:
    f.write(evo_imports + evo_content)

# ================= LEVEL UP MOVES =================
lvl_content = lvl_block
lvl_content = lvl_content.replace('async function checkNewMovesOnLevelUp', 'export async function checkNewMovesOnLevelUp')
lvl_content = lvl_content.replace('function offerLearnMove', 'export function offerLearnMove')
lvl_imports = "import { appendToLog, showSelectionModal } from '../../main.js';\n\n"
with open('src/ui/levelup_moves.js', 'w', encoding='utf-8') as f:
    f.write(lvl_imports + lvl_content)

# ================= TM RELEARNER =================
tm_content = tm_block
tm_content = tm_content.replace('async function fetchLearnableMoves', 'export async function fetchLearnableMoves')
tm_content = tm_content.replace('async function openMoveRelearner', 'export async function openMoveRelearner')
tm_content = tm_content.replace('function showSlotPicker', 'export function showSlotPicker')
# Replace state access for myTeam
tm_content = tm_content.replace('currentPokemonIndex', 'getTeamState().currentPokemonIndex')
tm_content = tm_content.replace('myTeam', 'getTeamState().myTeam')
tm_imports = """import { 
  getTeamState, refreshProfileUI, autoSave, showToast, 
  getItemQty, removeItem, updateInventoryDisplay 
} from '../../main.js';\n\n"""
with open('src/ui/tm.js', 'w', encoding='utf-8') as f:
    f.write(tm_imports + tm_content)

# ================= NICKNAME =================
nick_content = nick_block
nick_content = nick_content.replace('function editNickname', 'export function editNickname')
nick_content = nick_content.replace('currentPokemonIndex', 'getTeamState().currentPokemonIndex')
nick_content = nick_content.replace('myTeam', 'getTeamState().myTeam')
nick_imports = """import { 
  getTeamState, showToast, showTextInputModal, refreshProfileUI, autoSave 
} from '../../main.js';\n\n"""
with open('src/ui/nickname.js', 'w', encoding='utf-8') as f:
    f.write(nick_imports + nick_content)

# Delete blocks from main.js (reverse order)
del lines[s_nick:e_nick+1]
del lines[s_tm:e_tm+1]
del lines[s_lvl:e_lvl+1]
del lines[s_evo:e_evo+1]

main_content = "".join(lines)

# Export missing utils
utils = ['appendToLog', 'showSelectionModal', 'showTextInputModal', 'refreshProfileUI', 'getItemQty', 'autoSave', 'showToast', 'removeItem', 'updateInventoryDisplay']
for u in utils:
    main_content = re.sub(rf'^function {u}\(', f'export function {u}(', main_content, flags=re.MULTILINE)
    main_content = re.sub(rf'^async function {u}\(', f'export async function {u}(', main_content, flags=re.MULTILINE)

main_content = re.sub(r'^let evolutionCache =', 'export let evolutionCache =', main_content, flags=re.MULTILINE)

# Add getTeamState
team_state = """
export function getTeamState() {
  return { myTeam, currentPokemonIndex };
}
"""
main_content += team_state

# Add imports to main.js
import_stmt = """export { checkEvolution, triggerEvolution, getEvolutions, fetchEvolutionChain } from './src/ui/evolution.js';
export { checkNewMovesOnLevelUp, offerLearnMove } from './src/ui/levelup_moves.js';
export { fetchLearnableMoves, openMoveRelearner, showSlotPicker } from './src/ui/tm.js';
export { editNickname } from './src/ui/nickname.js';
"""
if 'import { REGIONS }' in main_content:
    main_content = main_content.replace("import { REGIONS }", import_stmt + "import { REGIONS }", 1)
else:
    main_content = import_stmt + main_content

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(main_content)

print("Features extracted successfully!")
