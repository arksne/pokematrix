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

s1, e1, shop_block_1 = get_block('const shopPrices = {};', lambda i, line: safe_check(i, 1, '// --- DISPLAY UPDATES ---'))
s2, e2, shop_block_2 = get_block('function initSellTab() {', lambda i, line: safe_check(i, 3, 'FEATURE: NICKNAME'))

if s1 == -1 or s2 == -1:
    print("Could not find shop blocks")
    print("block1:", s1, e1)
    print("block2:", s2, e2)
    exit(1)

# Extract content
shop_content = shop_block_1 + "\n\n" + shop_block_2

# Replace state accesses
shop_content = shop_content.replace('money < total', 'getShopState().money < total')
shop_content = shop_content.replace('money -= total;', 'modifyMoney(-total);')
shop_content = shop_content.replace('money += price;', 'modifyMoney(price);')
shop_content = shop_content.replace('money += sellPrice * sold;', 'modifyMoney(sellPrice * sold);')
shop_content = shop_content.replace('inventory[', 'getShopState().inventory[')
shop_content = re.sub(r'innerText = money;', 'innerText = getShopState().money;', shop_content)
shop_content = re.sub(r'\$\{money\}', '${getShopState().money}', shop_content)

# Prepend exports
shop_content = shop_content.replace('function openShop()', 'export function openShop()')
shop_content = shop_content.replace('function initShopEvents()', 'export function initShopEvents()')
shop_content = shop_content.replace('function initSellTab()', 'export function initSellTab()')

imports = """import { 
  getShopState, modifyMoney, getItemSpriteImg, showToast, 
  addItem, removeItem, updateInventoryDisplay, updateMoneyDisplay, 
  autoSave, showConfirmModal 
} from '../../main.js';
import { ITEMS } from '../data/items.js';

"""

shop_content = imports + shop_content

os.makedirs('src/ui', exist_ok=True)
with open('src/ui/shop.js', 'w', encoding='utf-8') as f:
    f.write(shop_content)

# Remove blocks from main (reverse order to not mess up indices)
del lines[s2:e2+1]
del lines[s1:e1+1]

main_content = "".join(lines)

# Export required functions in main.js
utils = ['getItemSpriteImg', 'showToast', 'addItem', 'removeItem', 'updateInventoryDisplay', 'updateMoneyDisplay', 'autoSave', 'showConfirmModal']
for u in utils:
    main_content = re.sub(rf'^function {u}\(', f'export function {u}(', main_content, flags=re.MULTILINE)
    main_content = re.sub(rf'^async function {u}\(', f'export async function {u}(', main_content, flags=re.MULTILINE)

# Add shop state getters
shop_state = """
export function getShopState() {
  return { money, inventory };
}
export function modifyMoney(delta) {
  money += delta;
}
"""

# Insert imports at the top
import_stmt = "import { openShop, initShopEvents, initSellTab } from './src/ui/shop.js';\n"
if 'import { REGIONS }' in main_content:
    main_content = main_content.replace("import { REGIONS }", import_stmt + "import { REGIONS }", 1)
else:
    main_content = import_stmt + main_content

main_content += shop_state

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(main_content)

print("Shop extracted to src/ui/shop.js")
