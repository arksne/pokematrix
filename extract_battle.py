#!/usr/bin/env python3
"""
Extract Battle System from main.js -> src/battle/core.js

Approach:
- Cut battle block (BATTLE SYSTEM UTILS -> SHOP SYSTEM) AS-IS  
- Cut weather block and battle persistence block too
- Move battle state `let` variables into core.js
- core.js imports getTeamState/getInvState/getMapState/getPokedexState etc
- core.js uses getTeamState().myTeam directly (returns reference, mutations work)
- For money (primitive), replace `money +=` with `modifyMoney()`
- main.js re-exports all battle functions
"""
import os, re

MAIN = 'main.js'
OUT = 'src/battle/core.js'

with open(MAIN, 'r') as f:
    text = f.read()
lines = text.split('\n')
total = len(lines)

# ---- Find section boundaries ----
def find_line(marker, lines, after=0):
    for i, l in enumerate(lines):
        if i >= after and marker in l:
            return i
    return None

battle_start = find_line('// --- BATTLE SYSTEM UTILS ---', lines)
battle_end = find_line('// --- SHOP SYSTEM (NEW) ---', lines)
weather_start = find_line('// --- WEATHER ---', lines)
weather_end = find_line('// --- QUESTS (Feature 5) ---', lines, after=weather_start+1)
persist_start = find_line('// --- BATTLE STATE PERSISTENCE', lines)
persist_end = find_line('const MAX_IV', lines)
if persist_end: persist_end += 1  # include MAX_IV line

print(f"Weather: {weather_start+1}..{weather_end}")
print(f"Persistence: {persist_start+1}..{persist_end}")
print(f"Battle: {battle_start+1}..{battle_end}")

# ---- Extract blocks ----
weather_block = '\n'.join(lines[weather_start:weather_end])
persist_block = '\n'.join(lines[persist_start:persist_end])
battle_block = '\n'.join(lines[battle_start:battle_end])

# ---- Collect function names from each block ----
func_pat = re.compile(r'^(?:export\s+)?(?:async\s+)?function\s+(\w+)', re.MULTILINE)
weather_funcs = func_pat.findall(weather_block)
persist_funcs = func_pat.findall(persist_block)
battle_funcs = func_pat.findall(battle_block)
all_funcs = weather_funcs + persist_funcs + battle_funcs
print(f"Weather funcs: {weather_funcs}")
print(f"Persist funcs: {persist_funcs}")
print(f"Battle funcs ({len(battle_funcs)}): {battle_funcs[:10]}...")

# ---- Remove export keyword from all blocks ----
def strip_export(text):
    return re.sub(r'^export ((?:async )?function )', r'\1', text, flags=re.MULTILINE)

weather_block = strip_export(weather_block)
persist_block = strip_export(persist_block)
battle_block = strip_export(battle_block)

# ---- Battle state vars to move ----
vars_to_move = {
    'activeWild': 'null', 'wildLvl': '5', 'wildMaxHP': '0', 'wildCurHP': '0',
    'wildStatus': 'null', 'wildSleepTurns': '0', 'escapeAttempts': '0',
    'wildMovesDetailed': '[]', 'wildMovesPP': 'null', 'battleRound': '0',
    'activePlayerMon': 'null', 'playerMovesDetailed': '[]',
    'battleType': "'wild'", 'gymLeaderKey': 'null', 'gymTeamIndex': '0',
    'gymTeamData': 'null', 'itemsUsedInBattle': '0',
    'huntActive': 'false', 'huntTimer': 'null',
    'currentWeather': "'clear'",
}

state_block = '// === BATTLE STATE ===\n'
for var, default in vars_to_move.items():
    state_block += f'let {var} = {default};\n'
state_block += '\n'

# ---- Replace money mutations in extracted code ----
# Replace `money += X` with `modifyMoney(X)`
# Replace `money -= X` with `modifyMoney(-X)`
def fix_money(text):
    # money += expr;
    text = re.sub(r'\bmoney\s*\+=\s*([^;]+);', r'modifyMoney(\1);', text)
    # money -= expr;  
    text = re.sub(r'\bmoney\s*-=\s*([^;]+);', r'modifyMoney(-(\1));', text)
    return text

battle_block = fix_money(battle_block)
persist_block = fix_money(persist_block)
weather_block = fix_money(weather_block)

# ---- Replace direct references to main.js globals ----
# myTeam -> getTeamState().myTeam
# money -> getShopState().money (for reads only, writes use modifyMoney)
# pokedexSeen -> getPokedexState().pokedexSeen
# etc.
# 
# Actually, this is DANGEROUS because these vars are used in hundreds of places
# with complex expressions. Instead, let's destructure at the top of each
# function that uses them... No, that's also too complex.
#
# SIMPLEST APPROACH: Export the raw arrays/objects from main.js directly
# Since they're reference types, mutations are visible.
# For money we already fixed with modifyMoney().
# So we just need to: import { myTeam, pokedexSeen, ... } from main.js
# But ES modules don't allow importing non-exported variables.
# We need to export them.
#
# Let's add exports for these globals in main.js and import them in core.js.

globals_needed = [
    'myTeam', 'pokedexSeen', 'pokedexCaught', 'currentLocationId', 
    'isDaytime', 'gymLeaders', 'eliteFour', 'champion', 'gymBadges',
    'expShareActive', 'quests', 'questProgress', 'completedQuests',
    'visitedLocations', 'inventory', 'money',
]

# Check which are actually used
combined_text = weather_block + persist_block + battle_block
globals_used = [g for g in globals_needed if re.search(r'\b' + g + r'\b', combined_text)]
print(f"Globals from main.js needed: {globals_used}")

# ---- Imports from main.js ----
# Functions already exported from main.js
func_imports = [
    'getLocation', 'showToast', 'showConfirmModal', 'showSelectionModal',
    'addItem', 'removeItem', 'getItemQty', 'itemDef', 'hasItem',
    'autoSave', 'updateMoneyDisplay', 'modifyMoney',
    'refreshProfileUI', 'updateInventoryDisplay',
    'checkEvolution', 'triggerEvolution',
    'lsKey', 'getTeamState', 'getInvState', 'getMapState', 'getShopState',
    'getPokedexState',
    'getItemSpriteImg', 'renderBattleItemSelect',
    'getTypeGradient', 'getPowerStars', 'getRarityStars',
    'saveActiveMonData',
    'updateDynamicEVs', 'updateQADisplays',
    'escHtml', 'renderLocation',
]

# Filter to those actually used
func_imports = [f for f in func_imports if f in combined_text and f not in all_funcs]

# Global vars: we need to export them from main.js as getGameGlobals()
# and destructure at the top of core.js... but that won't work for mutations.
# 
# Better: export a single `gameState` object from main.js
# Actually the simplest: just make a getGameState() that returns refs

# ---- Build core.js ----
header = f"""import {{
  {', '.join(func_imports)},
  getGameState
}} from '../../main.js';
import {{ natures }} from '../data/natures.js';

// Get references to mutable game state from main.js
// These are objects/arrays so mutations are visible across modules
const _gs = getGameState();
const myTeam = _gs.myTeam;
const pokedexSeen = _gs.pokedexSeen;
const pokedexCaught = _gs.pokedexCaught;
const gymLeaders = _gs.gymLeaders;
const eliteFour = _gs.eliteFour;
const champion = _gs.champion;
const gymBadges = _gs.gymBadges;
const quests = _gs.quests;
const questProgress = _gs.questProgress;
const completedQuests = _gs.completedQuests;
const visitedLocations = _gs.visitedLocations;
const inventory = _gs.inventory;

// These are getters (re-evaluated each time because they're primitives)
function _isDaytime() {{ return _gs.isDaytime; }}
function _currentLocationId() {{ return _gs.currentLocationId; }}
function _expShareActive() {{ return _gs.expShareActive; }}
function _money() {{ return _gs.money; }}

"""

# Hmm, this approach has a problem too: _gs is evaluated once at import time.
# For reference types that's fine (myTeam array stays the same array).
# For primitives like isDaytime, currentLocationId, money, expShareActive - 
# we need to re-read each time.
# 
# The cleanest solution: export a SINGLE OBJECT from main.js that contains
# all these as properties, and the battle code accesses them as gs.myTeam etc.
# But that requires renaming every reference in 2600 lines of code. 
#
# FINAL DECISION: For this phase, let's NOT move the battle state variables
# or global game state out. Instead, let's make core.js a "module of functions"
# that takes game state as parameters wherever needed.
# 
# Actually, the cleanest approach for THIS codebase is:
# Don't extract battle yet. The coupling is too deep.
# Instead, just reorganize the code within main.js.
# 
# But the user wants it extracted. So let's do a PARTIAL extraction:
# Move only the PURE functions (no global state) and the CONSTANTS.
# Keep the stateful functions in main.js.

print("\n=== IMPORTANT ===")
print("The battle system is deeply coupled to global game state.")
print("Full extraction requires replacing ~50 global variable references.")
print("Proceeding with extraction using getGameState() bridge pattern...")

# Actually, let's use a simpler pattern that works:
# Export getGameState() from main.js that returns an object with GETTER properties
# Then in core.js: const GS = getGameState()
# Access: GS.myTeam (returns current value via getter)

# Rewrite header:
header = f"""import {{
  {', '.join(func_imports)},
  getGameState
}} from '../../main.js';
import {{ natures }} from '../data/natures.js';

"""

# In the battle code, replace bare global references with GS.xxx
# We need to be careful:
# - myTeam -> GS.myTeam (reference type, mutations work!)
# - money -> GS.money (read only, writes use modifyMoney())  
# - currentLocationId -> GS.currentLocationId
# etc.

# Actually, for reference types (arrays, objects, Sets), 
# we can just do: const {{ myTeam, pokedexSeen, ... }} = GS;
# and mutations through these references WILL be visible to main.js
# because they're the same underlying objects.

# For primitives, we'll use functions.

ref_types = ['myTeam', 'pokedexSeen', 'pokedexCaught', 'gymLeaders', 
             'eliteFour', 'champion', 'gymBadges', 'quests', 
             'questProgress', 'completedQuests', 'visitedLocations', 'inventory']

prim_types = ['currentLocationId', 'isDaytime', 'expShareActive', 'money']

# Add destructuring at top of core.js (after imports)
destructure = "// Reference types - mutations visible across modules\n"
destructure += "let GS;\n"
destructure += "function initBattleRefs() {\n"
destructure += "  GS = getGameState();\n"
destructure += "}\n"
destructure += "// Call once after main.js is loaded\n"
destructure += "setTimeout(initBattleRefs, 0);\n\n"

# Replace primitive globals in battle code
for prim in prim_types:
    if prim in combined_text:
        # Don't replace inside strings, property access, or when it's already GS.xxx
        # Simple word-boundary replacement
        pattern = r'(?<![.\w"\'])' + re.escape(prim) + r'(?![\w"\':.])'
        replacement = f'GS.{prim}'
        battle_block = re.sub(pattern, replacement, battle_block)
        persist_block = re.sub(pattern, replacement, persist_block)
        weather_block = re.sub(pattern, replacement, weather_block)

# Replace reference type globals
for ref in ref_types:
    if ref in combined_text:
        pattern = r'(?<![.\w"\'])' + re.escape(ref) + r'(?![\w"\':.])'
        replacement = f'GS.{ref}'
        battle_block = re.sub(pattern, replacement, battle_block)
        persist_block = re.sub(pattern, replacement, persist_block)
        weather_block = re.sub(pattern, replacement, weather_block)

# Fix double-replacements
for block_name in ['battle_block', 'persist_block', 'weather_block']:
    exec(f"{block_name} = {block_name}.replace('GS.GS.', 'GS.')")

# ---- Accessors ----
accessors = """
// === STATE ACCESSORS ===
export function getBattleVars() {
  return {
    activeWild, wildLvl, wildMaxHP, wildCurHP, wildStatus, wildSleepTurns,
    escapeAttempts, wildMovesDetailed, wildMovesPP, battleRound,
    activePlayerMon, playerMovesDetailed, battleType, gymLeaderKey,
    gymTeamIndex, gymTeamData, gymTeamIndexInMember,
    currentWeather, itemsUsedInBattle, huntActive, huntTimer,
  };
}

export function setBattleVars(updates) {
  for (const [k, v] of Object.entries(updates)) {
    switch(k) {
      case 'activeWild': activeWild = v; break;
      case 'wildLvl': wildLvl = v; break;
      case 'wildMaxHP': wildMaxHP = v; break;
      case 'wildCurHP': wildCurHP = v; break;
      case 'wildStatus': wildStatus = v; break;
      case 'wildSleepTurns': wildSleepTurns = v; break;
      case 'escapeAttempts': escapeAttempts = v; break;
      case 'wildMovesDetailed': wildMovesDetailed = v; break;
      case 'wildMovesPP': wildMovesPP = v; break;
      case 'battleRound': battleRound = v; break;
      case 'activePlayerMon': activePlayerMon = v; break;
      case 'playerMovesDetailed': playerMovesDetailed = v; break;
      case 'battleType': battleType = v; break;
      case 'gymLeaderKey': gymLeaderKey = v; break;
      case 'gymTeamIndex': gymTeamIndex = v; break;
      case 'gymTeamData': gymTeamData = v; break;
      case 'gymTeamIndexInMember': gymTeamIndexInMember = v; break;
      case 'currentWeather': currentWeather = v; break;
      case 'itemsUsedInBattle': itemsUsedInBattle = v; break;
      case 'huntActive': huntActive = v; break;
      case 'huntTimer': huntTimer = v; break;
    }
  }
}
"""

all_exported_funcs = all_funcs + ['getBattleVars', 'setBattleVars']
all_exported_funcs = list(dict.fromkeys(all_exported_funcs))

export_stmt = f"\nexport {{ {', '.join(all_exported_funcs)} }};\n"

# ---- Write core.js ----
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    f.write(header)
    f.write(state_block)
    f.write(destructure)
    f.write(weather_block)
    f.write('\n\n')
    f.write(persist_block)
    f.write('\n\n')
    f.write(battle_block)
    f.write('\n')
    f.write(accessors)
    f.write(export_stmt)

print(f"\nWrote {OUT}")

# ---- Update main.js ----
# Remove the 3 blocks (in reverse order to preserve indices)
ranges = sorted([
    (battle_start, battle_end),
    (persist_start, persist_end),
    (weather_start, weather_end),
], key=lambda x: x[0], reverse=True)

new_lines = list(lines)
for s, e in ranges:
    new_lines = new_lines[:s] + new_lines[e:]

# Remove battle state var declarations
filtered = []
for line in new_lines:
    stripped = line.strip()
    skip = False
    for var in vars_to_move:
        if re.match(rf'^let {re.escape(var)}\b', stripped):
            skip = True
            break
    if not skip:
        filtered.append(line)
new_lines = filtered

# Add re-export line after inventory exports
for i, line in enumerate(new_lines):
    if "from './src/ui/inventory.js'" in line:
        reexport = f"export {{ {', '.join(all_exported_funcs)} }} from './src/battle/core.js';"
        new_lines.insert(i + 1, reexport)
        break

# Add getGameState() export near the other state getters
for i, line in enumerate(new_lines):
    if 'export function getInvState' in line:
        game_state = """
export function getGameState() {
  return {
    get myTeam() { return myTeam; },
    get pokedexSeen() { return pokedexSeen; },
    get pokedexCaught() { return pokedexCaught; },
    get currentLocationId() { return currentLocationId; },
    get isDaytime() { return isDaytime; },
    get gymLeaders() { return gymLeaders; },
    get eliteFour() { return eliteFour; },
    get champion() { return champion; },
    get gymBadges() { return gymBadges; },
    get expShareActive() { return expShareActive; },
    get quests() { return quests; },
    get questProgress() { return questProgress; },
    get completedQuests() { return completedQuests; },
    get visitedLocations() { return visitedLocations; },
    get inventory() { return inventory; },
    get money() { return money; },
  };
}
"""
        new_lines.insert(i, game_state)
        break

with open(MAIN, 'w') as f:
    f.write('\n'.join(new_lines))

print(f"Updated {MAIN}: {len(new_lines)} lines (was {total})")
print(f"\nRun: npm run build")
