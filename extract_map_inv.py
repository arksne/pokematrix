import os
import re

with open('main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def find_block(start_marker, end_marker):
    start = -1
    for i, line in enumerate(lines):
        if start == -1 and start_marker in line:
            start = i
        if start != -1 and end_marker in line:
            return start, i
    return -1, -1

# 1. MAP BLOCKS
s1, e1 = find_block('function getLocation(locId)', "return 'kanto';\n}")
s2, e2 = find_block('function travelToRegion', 'renderLocation(targetLoc);\n}')
s3, e3 = find_block('// --- LOCATION ENGINE ---', 'autoSave();\n}')

map_code = "".join(lines[s1:e1+1]) + "\n" + "".join(lines[s2:e2+1]) + "\n" + "".join(lines[s3:e3+1])

map_code = map_code.replace('function getLocation', 'export function getLocation')
map_code = map_code.replace('function getRegionOfLocation', 'export function getRegionOfLocation')
map_code = map_code.replace('function travelToRegion', 'export function travelToRegion')
map_code = map_code.replace('function renderLocation', 'export function renderLocation')

map_code = map_code.replace('currentLocationId', 'getMapState().currentLocationId')
map_code = map_code.replace('getMapState().currentLocationId = locId', 'setCurrentLocationId(locId)')
map_code = map_code.replace('currentRegion', 'getMapState().currentRegion')
map_code = map_code.replace('getMapState().currentRegion = targetRegion', 'setCurrentRegion(targetRegion)')
map_code = map_code.replace('getMapState().currentRegion = getRegionOfLocation(locId)', 'setCurrentRegion(getRegionOfLocation(locId))')
map_code = map_code.replace('lastLocation = null', 'setLastLocation(null)')
map_code = map_code.replace('lastLocation', 'getMapState().lastLocation')

map_imports = """import {
  getMapState, setCurrentLocationId, setCurrentRegion, setLastLocation, 
  REGIONS, TRANSPORT_HUBS, visitedLocations, checkQuestProgress, autoSave,
  showToast, appendToLog, hasItem, removeItem, itemDef, updatePlayerLocation
} from '../../main.js';\n\n"""

with open('src/ui/map.js', 'w', encoding='utf-8') as f:
    f.write(map_imports + map_code)


# 2. INVENTORY BLOCK
s4 = -1
e4 = -1
for i, line in enumerate(lines):
    if s4 == -1 and 'function initInventoryEvents()' in line:
        s4 = i
    if s4 != -1 and 'export function getTypeColor' in line:
        e4 = i - 1
        break

inv_code = "".join(lines[s4:e4+1])

inv_code = inv_code.replace('function initInventoryEvents', 'export function initInventoryEvents')
inv_code = inv_code.replace('function updateDynamicEVs', 'export function updateDynamicEVs')
inv_code = inv_code.replace('function renderBattleItemSelect', 'export function renderBattleItemSelect')
inv_code = inv_code.replace('function updateQADisplays', 'export function updateQADisplays')
inv_code = inv_code.replace('function renderInventory', 'export function renderInventory')
inv_code = inv_code.replace('function useItem', 'export function useItem')
inv_code = inv_code.replace('function getHeldItemName', 'export function getHeldItemName')
inv_code = inv_code.replace('function openHeldItemPicker', 'export function openHeldItemPicker')

inv_code = inv_code.replace('currentPokemonIndex', 'getTeamState().currentPokemonIndex')
inv_code = inv_code.replace('myTeam', 'getTeamState().myTeam')
inv_code = inv_code.replace('money', 'getInvState().money')
inv_code = inv_code.replace('eggs', 'getInvState().eggs')
inv_code = inv_code.replace('ITEMS', 'getInvState().ITEMS')
inv_code = inv_code.replace('activeNature', 'getInvState().activeNature')
inv_code = inv_code.replace('trainingStages', 'getInvState().trainingStages')

inv_code = inv_code.replace('expShareActive = !expShareActive;', 'toggleExpShare();')
inv_code = inv_code.replace('expShareActive', 'getInvState().expShareActive')

inv_imports = """import {
  getTeamState, getInvState, toggleExpShare, 
  addItem, removeItem, getItemQty, itemDef,
  showToast, showConfirmModal, showSelectionModal,
  refreshProfileUI, checkEvolution, triggerEvolution,
  cureStatus, startFishing, openCrafting, openMoveRelearner,
  hatchEgg, giveBerryToMon, autoSave, getLocationHasWater
} from '../../main.js';\n\n"""

with open('src/ui/inventory.js', 'w', encoding='utf-8') as f:
    f.write(inv_imports + inv_code)

# DELETIONS
# Must delete in reverse order to preserve indices!
blocks = [(s4, e4), (s3, e3), (s2, e2), (s1, e1)]
blocks.sort(key=lambda x: x[0], reverse=True)

for s, e in blocks:
    if s != -1 and e != -1:
        del lines[s:e+1]

main_content = "".join(lines)

utils = [
    'hasItem', 'itemDef', 'updatePlayerLocation', 'checkQuestProgress',
    'addItem', 'cureStatus', 'startFishing', 'openCrafting', 
    'hatchEgg', 'giveBerryToMon', 'getLocationHasWater'
]
for u in utils:
    main_content = re.sub(rf'^function {u}\(', f'export function {u}(', main_content, flags=re.MULTILINE)

state_exports = """
export function getMapState() { return { currentLocationId, currentRegion, lastLocation }; }
export function setCurrentLocationId(id) { currentLocationId = id; }
export function setCurrentRegion(reg) { currentRegion = reg; }
export function setLastLocation(loc) { lastLocation = loc; }

export function getInvState() { return { money, eggs, ITEMS, activeNature, trainingStages, expShareActive }; }
export function toggleExpShare() { expShareActive = !expShareActive; }
"""
main_content += state_exports

import_stmt = """export { getLocation, getRegionOfLocation, travelToRegion, renderLocation } from './src/ui/map.js';
export { initInventoryEvents, updateDynamicEVs, updateInventoryDisplay, renderBattleItemSelect, updateQADisplays, renderInventory, useItem, getHeldItemName, openHeldItemPicker } from './src/ui/inventory.js';
"""
main_content = main_content.replace("import { REGIONS }", import_stmt + "import { REGIONS }", 1)

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(main_content)

print("Map and Inventory extracted successfully!")
