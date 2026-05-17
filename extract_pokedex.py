import os
import re

with open('main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find Pokedex section
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if line.startswith('// FEATURE: POKEDEX'):
        start_idx = i - 1 # Include the ============ above
    if start_idx != -1 and line.startswith('function updateTimeOfDay()'):
        end_idx = i - 2 # Skip the ============ above
        break

if start_idx == -1 or end_idx == -1:
    print("Could not find Pokedex section")
    exit(1)

pokedex_lines = lines[start_idx:end_idx]
pokedex_content = "".join(pokedex_lines)

# Inject state getter call into the functions
pokedex_content = pokedex_content.replace(
    'function openPokedex() {',
    'export function openPokedex() {\n  const { pokedexSeen, pokedexCaught, POKEDEX_ALL, pokedexData, pokedexTotal } = getPokedexState();'
)
pokedex_content = pokedex_content.replace(
    'async function showPokedexInfo(speciesName) {',
    'export async function showPokedexInfo(speciesName) {\n  const { pokedexSeen, pokedexCaught, POKEDEX_ALL, pokedexData, pokedexTotal } = getPokedexState();'
)
pokedex_content = pokedex_content.replace(
    'function getPokedexId(speciesName) {',
    'export function getPokedexId(speciesName) {\n  const { POKEDEX_ALL } = getPokedexState();'
)

# Imports for pokedex.js
imports = """import { 
  getPokedexState, getTypeColor, getTypeGradient, getEvolutions, 
  evolvesFromMap, getPowerStars, getRarityStars 
} from '../../main.js';
import { gymLeaders } from '../data/gyms.js';

"""

pokedex_content = imports + pokedex_content

os.makedirs('src/ui', exist_ok=True)
with open('src/ui/pokedex.js', 'w', encoding='utf-8') as f:
    f.write(pokedex_content)

# Remove the section from main.js
del lines[start_idx:end_idx]

main_content = "".join(lines)

# Prepend export to the utility functions in main.js
utils_to_export = [
    'getTypeColor', 'getTypeGradient', 'getEvolutions', 'getPowerStars', 'getRarityStars'
]
for util in utils_to_export:
    main_content = re.sub(rf'^function {util}\(', f'export function {util}(', main_content, flags=re.MULTILINE)
    main_content = re.sub(rf'^const {util} =', f'export const {util} =', main_content, flags=re.MULTILINE)
    main_content = re.sub(rf'^let {util} =', f'export let {util} =', main_content, flags=re.MULTILINE)
    
main_content = re.sub(r'^let evolvesFromMap =', 'export let evolvesFromMap =', main_content, flags=re.MULTILINE)
main_content = re.sub(r'^const evolvesFromMap =', 'export const evolvesFromMap =', main_content, flags=re.MULTILINE)

# Add getPokedexState function and imports
state_getter = """
export function getPokedexState() {
  return { pokedexSeen, pokedexCaught, POKEDEX_ALL, pokedexData, pokedexTotal };
}
"""

# Insert imports at the top
import_stmt = "import { openPokedex, showPokedexInfo } from './src/ui/pokedex.js';\n"
if 'import { REGIONS }' in main_content:
    main_content = main_content.replace("import { REGIONS }", import_stmt + "import { REGIONS }", 1)
else:
    main_content = import_stmt + main_content

# Append state getter
main_content += state_getter

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(main_content)

print("Pokedex extracted to src/ui/pokedex.js")
