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

# Chat System
s_chat, e_chat, chat_block = get_block('// FEATURE: CHAT SYSTEM', lambda i, l: safe_check(i, 2, 'TRAINERS TAB'))
# Trainers Tab
s_train, e_train, train_block = get_block('// TRAINERS TAB', lambda i, l: safe_check(i, 2, 'TRAINER CARD'))

if s_chat == -1 or s_train == -1:
    print("Error finding blocks:", s_chat, s_train)
    exit(1)

os.makedirs('src/ui', exist_ok=True)

# Process Chat
chat_content = chat_block
chat_content = chat_content.replace('async function loadChatMessages', 'export async function loadChatMessages')
chat_content = chat_content.replace('function startChatPolling', 'export function startChatPolling')
chat_content = chat_content.replace('function initChatSocket', 'export function initChatSocket')
chat_content = chat_content.replace('function stopChatPolling', 'export function stopChatPolling')
chat_content = chat_content.replace('async function sendChatMessage', 'export async function sendChatMessage')

chat_imports = """import { 
  API_BASE, socket, openTrainerProfile, getCloudAuthHeaders 
} from '../../main.js';\n\n"""

with open('src/ui/chat.js', 'w', encoding='utf-8') as f:
    f.write(chat_imports + chat_content)


# Process Trainers
train_content = train_block
train_content = train_content.replace('async function loadAllTrainers', 'export async function loadAllTrainers')
train_content = train_content.replace('function initTrainersTab', 'export function initTrainersTab')
train_content = train_content.replace('function showAccountPanel', 'export function showAccountPanel')

# For onlinePlayersList, trainerNickname, tgUser
train_content = train_content.replace('onlinePlayersList', 'getSocialState().onlinePlayersList')
train_content = train_content.replace('trainerNickname = ', 'setTrainerNickname(')
train_content = train_content.replace('.value.trim();', '.value.trim());')
train_content = train_content.replace('trainerNickname', 'getSocialState().trainerNickname')
train_content = train_content.replace('tgUser', 'getSocialState().tgUser')

train_imports = """import { 
  getSocialState, setTrainerNickname, openTrainerProfile, lsKey, renderTrainerCard, autoSave, showToast 
} from '../../main.js';\n\n"""
# We need escHtml inside trainers.js? It calls escHtml. Let's make sure escHtml is exported or use escapeHtml from chat.js.
# Actually, escHtml might be in main.js. Let's just import it from main.js.
train_imports = train_imports.replace('showToast ', 'showToast, escHtml ')

with open('src/ui/trainers.js', 'w', encoding='utf-8') as f:
    f.write(train_imports + train_content)


# Delete blocks
del lines[s_train:e_train+1]
del lines[s_chat:e_chat+1]

main_content = "".join(lines)

# Export utils
utils = ['openTrainerProfile', 'getCloudAuthHeaders', 'lsKey', 'renderTrainerCard', 'escHtml']
for u in utils:
    main_content = re.sub(rf'^function {u}\(', f'export function {u}(', main_content, flags=re.MULTILINE)

# Export socket and API_BASE
main_content = re.sub(r'^let socket =', 'export let socket =', main_content, flags=re.MULTILINE)
main_content = re.sub(r'^const API_BASE =', 'export const API_BASE =', main_content, flags=re.MULTILINE)

# Social state
social_state = """
export function getSocialState() {
  return { onlinePlayersList, trainerNickname, tgUser };
}
export function setTrainerNickname(name) {
  trainerNickname = name;
}
"""
main_content += social_state

import_stmt = """export { loadChatMessages, startChatPolling, initChatSocket, stopChatPolling, sendChatMessage } from './src/ui/chat.js';
export { loadAllTrainers, initTrainersTab, showAccountPanel } from './src/ui/trainers.js';
"""

if 'import { REGIONS }' in main_content:
    main_content = main_content.replace("import { REGIONS }", import_stmt + "import { REGIONS }", 1)
else:
    main_content = import_stmt + main_content

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(main_content)

print("Social modules extracted!")
