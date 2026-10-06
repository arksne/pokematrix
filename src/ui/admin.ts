import { getIsAdmin, getTgUser } from '../game/getters.js';
import { showToast } from '../utils/dom.js';
import { apiFetch } from '../game/apiClient.js';
import { state, generateUID, lsKey } from '../game/state.js';
import { store } from '../game/store.js';
import { autoSave } from '../game/save.js';
import { GEN_STARTERS } from '../data/starters.js';
import { checkBreeding, hatchEgg } from './daycare.js';
import { setUnlockedAchievements } from './achievements.js';
import { addNotification } from './notifications.js';

export function initAdminPanel() {
  if (!getIsAdmin()) return;
  if (document.getElementById('admin-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'admin-fab';
  fab.innerHTML = '\u{1F6E0}';
  fab.title = 'Admin-panel';
  fab.style.cssText = 'position:fixed;bottom:120px;right:16px;width:48px;height:48px;border-radius:50%;background:#af52de;color:#fff;border:none;font-size:1.4rem;z-index:250;box-shadow:0 4px 12px rgba(0,0,0,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;';
  document.body.appendChild(fab);

  const modal = document.createElement('div');
  modal.id = 'admin-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = [
    '<div class="selection-modal-card" style="max-width:420px;width:95%;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:12px;">',
    '  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--tma-border);padding-bottom:6px;">',
    '    <h3 style="margin:0;">\u{1F6E0} Admin</h3>',
    '    <button class="tma-btn" id="btn-admin-close" style="padding:4px 8px;font-size:0.75rem;margin:0;background:#ff3b30;">❌</button>',
    '  </div>',
    '  <div style="display:flex;gap:4px;border-bottom:1px solid var(--tma-border);padding-bottom:4px;">',
    '    <button class="tma-btn admin-tab-btn active" data-tab="tab-editor" style="flex:1;font-size:0.75rem;padding:6px 2px;margin:0;">✏️ Editor</button>',
    '    <button class="tma-btn admin-tab-btn" data-tab="tab-players" style="flex:1;font-size:0.75rem;padding:6px 2px;margin:0;">⚡ Commands</button>',
    '    <button class="tma-btn admin-tab-btn" data-tab="tab-server" style="flex:1;font-size:0.75rem;padding:6px 2px;margin:0;">🌐 Server</button>',
    '    <button class="tma-btn admin-tab-btn" data-tab="tab-saves" style="flex:1;font-size:0.75rem;padding:6px 2px;margin:0;">💾 Saves</button>',
    '    <button class="tma-btn admin-tab-btn" data-tab="tab-test" style="flex:1;font-size:0.75rem;padding:6px 2px;margin:0;">🧪 Tests</button>',
    '  </div>',
    '  <div id="tab-editor" class="admin-tab-content" style="display:flex;flex-direction:column;gap:4px;">',
    '    <div style="display:flex;gap:4px;align-items:center;">',
    '      <span style="font-size:0.75rem;font-weight:bold;color:var(--tma-text-muted);">Trainer:</span>',
    '      <input id="admin-editor-id" type="text" placeholder="Telegram ID" style="flex:1;padding:5px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);">',
    '      <button class="tma-btn" id="admin-editor-load" style="padding:5px 10px;font-size:0.7rem;background:#007aff;margin:0;">📥 Load</button>',
    '      <button class="tma-btn" id="admin-editor-self" style="padding:5px 10px;font-size:0.7rem;background:#af52de;margin:0;">🙋 Self</button>',
    '    </div>',
    '    <div id="admin-editor-status" style="font-size:0.7rem;color:var(--tma-text-muted);background:rgba(0,0,0,0.2);padding:5px 8px;border-radius:6px;min-height:22px;">Enter ID or press Self</div>',
    '    <div id="admin-editor-fields" style="display:none;flex-direction:column;gap:4px;">',
    '      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">',
    '        <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">Nickname',
    '          <input id="editor-nickname" type="text" style="padding:4px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '        </label>',
    '        <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">Money (¥)',
    '          <input id="editor-money" type="number" min="0" style="padding:4px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '        </label>',
    '      </div>',
    '      <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">Badges (comma separated)',
    '        <input id="editor-badges" type="text" placeholder="Boulder Badge, Cascade Badge, ..." style="padding:4px;font-size:0.72rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '      </label>',
    '      <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">Location',
    '        <select id="editor-location" style="padding:4px;font-size:0.72rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '          <option value="pewterCity">Pewter City</option><option value="ceruleanCity">Cerulean City</option>',
    '          <option value="vermilionCity">Vermilion City</option><option value="celadonCity">Celadon City</option>',
    '          <option value="lavenderTown">Lavender Town</option><option value="saffronCity">Saffron City</option>',
    '          <option value="fuchsiaCity">Fuschia City</option><option value="cinnabarIsland">Cinnabar Island</option>',
    '          <option value="goldenrodCity">Goldenrod City</option><option value="ecruteakCity">Ecruteak City</option>',
    '          <option value="olivineCity">Olivine City</option><option value="cianwoodCity">Cianwood City</option>',
    '          <option value="azaleaTown">Azalea Town</option><option value="violetCity">Violet City</option>',
    '          <option value="blackthornCity">Blackthorn City</option>',
    '        </select>',
    '      </label>',
    '      <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">save_data (JSON)',
    '        <textarea id="editor-save-json" rows="8" style="width:100%;padding:4px;font-size:0.65rem;font-family:monospace;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);resize:vertical;"></textarea>',
    '      </label>',
    '      <button class="tma-btn" id="admin-editor-save" style="width:100%;padding:8px;font-size:0.8rem;background:#34c759;margin:0;">💾 Save</button>',
    '    </div>',
    '  </div>',
    '  <div id="tab-players" class="admin-tab-content" style="display:none;flex-direction:column;gap:6px;">',
    '    <div style="display:flex;gap:4px;">',
    '      <select id="admin-user-select" style="flex:1.2;padding:6px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);"><option value="">-- Select trainer --</option></select>',
    '      <input id="admin-target-id" type="text" placeholder="or ID" style="flex:0.8;padding:6px 8px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);">',
    '      <button class="tma-btn" id="admin-lookup" style="padding:6px 10px;font-size:0.75rem;background:#007aff;margin:0;">🔍</button>',
    '    </div>',
    '    <div id="admin-target-info" style="font-size:0.72rem;color:var(--tma-text-muted);background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;min-height:28px;">Find or select a player first</div>',
    '    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:4px;">',
    '      <button class="tma-btn admin-id-act" data-act="money" style="font-size:0.68rem;padding:6px 2px;background:#ff9500;margin:0;">💰 +100k</button>',
    '      <button class="tma-btn admin-id-act" data-act="badges" style="font-size:0.68rem;padding:6px 2px;background:#ff3b30;margin:0;">🏅 Badges</button>',
    '      <button class="tma-btn admin-id-act" data-act="heal" style="font-size:0.68rem;padding:6px 2px;background:#007aff;margin:0;">🏥 Heal</button>',
    '      <button class="tma-btn admin-id-act" data-act="lvl50" style="font-size:0.68rem;padding:6px 2px;background:#5856d6;margin:0;">📈 Lv50</button>',
    '      <button class="tma-btn admin-id-act" data-act="reset" style="font-size:0.68rem;padding:6px 2px;background:#ff3b30;margin:0;">💣 Reset</button>',
    '    </div>',
    '    <div style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--tma-border);padding-top:4px;">',
    '      <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">🎒 Give item:</span>',
    '      <div style="display:flex;gap:4px;">',
    '        <input id="admin-item-id" type="text" placeholder="id (ultraBall)" style="flex:1;padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '        <input id="admin-item-qty" type="number" value="999" min="1" max="9999" style="width:60px;padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '        <button class="tma-btn" id="admin-give-item-btn" style="font-size:0.68rem;padding:4px 8px;background:#34c759;margin:0;">👤 Give</button>',
    '        <button class="tma-btn" id="admin-give-self-btn" style="font-size:0.68rem;padding:4px 8px;background:#af52de;margin:0;">🙋 Self</button>',
    '      </div>',
    '    </div>',
    '    <div style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--tma-border);padding-top:4px;">',
    '      <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">🗺️ Teleport:</span>',
    '      <div style="display:flex;gap:4px;">',
    '        <select id="admin-tp-loc" style="flex:1;padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '          <option value="pewterCity">Pewter City</option><option value="ceruleanCity">Cerulean City</option>',
    '          <option value="vermilionCity">Vermilion City</option><option value="celadonCity">Celadon City</option>',
    '          <option value="lavenderTown">Lavender Town</option><option value="saffronCity">Saffron City</option>',
    '          <option value="fuchsiaCity">Fuschia City</option><option value="cinnabarIsland">Cinnabar Island</option>',
    '          <option value="goldenrodCity">Goldenrod City</option><option value="ecruteakCity">Ecruteak City</option>',
    '          <option value="olivineCity">Olivine City</option><option value="cianwoodCity">Cianwood City</option>',
    '          <option value="azaleaTown">Azalea Town</option><option value="violetCity">Violet City</option>',
    '          <option value="blackthornCity">Blackthorn City</option>',
    '        </select>',
    '        <button class="tma-btn" id="admin-tp-btn" style="padding:4px 10px;font-size:0.68rem;background:#5ac8fa;margin:0;">👤 TP</button>',
    '        <button class="tma-btn" id="admin-tp-self-btn" style="padding:4px 8px;font-size:0.68rem;background:#af52de;margin:0;">🙋 Self</button>',
    '      </div>',
    '    </div>',
    '    <div style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--tma-border);padding-top:4px;">',
    '      <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">✨ Spawn pokemon:</span>',
    '      <select id="admin-spawn-target" style="padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '        <option value="team">Self - team</option><option value="pc">Self - PC</option><option value="target_team">Trainer (ID) - team</option><option value="target_pc">Trainer (ID) - PC</option>',
    '      </select>',
    '      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">',
    '        <input id="admin-spawn-species" type="text" placeholder="species (pikachu)" style="padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '        <input id="admin-spawn-level" type="number" placeholder="lvl" value="50" min="1" max="100" style="padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '      </div>',
    '      <select id="admin-spawn-nature" style="padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '        <option value="-1">🎲 Random</option>',
    '        <option value="0">Hardy</option><option value="1">Lonely</option><option value="2">Brave</option><option value="3">Adamant</option>',
    '        <option value="4">Naughty</option><option value="5">Bold</option><option value="6">Docile</option><option value="7">Relaxed</option>',
    '        <option value="8">Impish</option><option value="9">Lax</option><option value="10">Timid</option><option value="11">Hasty</option>',
    '        <option value="12">Serious</option><option value="13">Jolly</option><option value="14">Naive</option><option value="15">Modest</option>',
    '        <option value="16">Mild</option><option value="17">Quiet</option><option value="18">Bashful</option><option value="19">Rash</option>',
    '        <option value="20">Calm</option><option value="21">Gentle</option><option value="22">Sassy</option><option value="23">Careful</option>',
    '        <option value="24">Quirky</option>',
    '      </select>',
    '      <div style="display:flex;gap:3px;align-items:center;flex-wrap:wrap;">',
    '        <label style="font-size:0.62rem;display:flex;align-items:center;gap:2px;color:var(--tma-text);"><input id="admin-spawn-shiny" type="checkbox"> Shiny</label>',
    '        <label style="font-size:0.62rem;display:flex;align-items:center;gap:2px;color:var(--tma-text);"><input id="admin-spawn-maxiv" type="checkbox" checked> Max IV</label>',
    '        <select id="admin-spawn-training" style="padding:3px;font-size:0.62rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);flex:1;">',
    '          <option value="0">None</option><option value="1">Basic</option><option value="2">Advanced</option>',
    '          <option value="3">Master</option><option value="4">Famous</option>',
    '        </select>',
    '      </div>',
    '      <button class="tma-btn" id="admin-spawn-btn" style="width:100%;padding:6px;font-size:0.75rem;background:#34c759;margin:1px 0 0;">✨ Spawn</button>',
    '    </div>',
    '  </div>',
    '  <div id="tab-server" class="admin-tab-content" style="display:none;flex-direction:column;gap:6px;">',
    '    <div><span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">📢 Global announcement:</span>',
    '      <textarea id="admin-broadcast-msg" placeholder="Message for all players..." style="width:100%;height:60px;padding:6px;font-size:0.72rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);font-family:monospace;resize:none;"></textarea>',
    '      <button class="tma-btn" id="admin-broadcast-btn" style="width:100%;padding:8px;font-size:0.75rem;background:#af52de;margin:0;">📢 Send</button>',
    '    </div>',
    '    <div style="border-top:1px solid var(--tma-border);padding-top:6px;">',
    '      <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">⚙️ Toggle features:</span>',
    '      <div style="display:grid;grid-template-columns:1fr;gap:4px;margin-top:4px;">',
    '        <button class="tma-btn admin-toggle-feature" data-feat="double_exp" style="font-size:0.7rem;padding:6px;margin:0;background:#ff9500;">📈 Double EXP</button>',
    '        <button class="tma-btn admin-toggle-feature" data-feat="beta_mode" style="font-size:0.7rem;padding:6px;margin:0;background:#007aff;">🧪 Beta Mode</button>',
    '        <button class="tma-btn admin-toggle-feature" data-feat="shiny_boost" style="font-size:0.7rem;padding:6px;margin:0;background:#34c759;">✨ Shiny Boost (x10)</button>',
    '        <button class="tma-btn admin-toggle-feature" data-feat="free_shop" style="font-size:0.7rem;padding:6px;margin:0;background:#ff3b30;">🛍️ Free Shop</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div id="tab-saves" class="admin-tab-content" style="display:none;flex-direction:column;gap:6px;">',
    '    <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">💾 История сейвов (кнопка — вернуть копию):</span>',
    '    <div id="admin-saves-list" style="display:flex;flex-direction:column;gap:4px;font-size:0.7rem;">Нажми «Обновить»</div>',
    '    <button class="tma-btn" id="admin-saves-refresh" style="width:100%;padding:6px;font-size:0.75rem;background:#007aff;margin:0;">🔄 Обновить</button>',
    '  </div>',
    '  <div id="tab-test" class="admin-tab-content" style="display:none;flex-direction:column;gap:8px;">',
    '    <div id="admin-test-status" style="font-size:0.7rem;color:var(--tma-text-muted);background:rgba(0,0,0,0.2);padding:5px 8px;border-radius:6px;min-height:22px;">Действует на СЕБЯ. Всё реально работает, не заглушки.</div>',
    '    <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">🥚 Яйца / разведение:</span>',
    '    <div style="display:flex;gap:4px;">',
    '      <input id="admin-test-egg" type="text" placeholder="вид (пусто — стартер)" style="flex:1;padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '      <button class="tma-btn" id="admin-test-egg-btn" style="font-size:0.68rem;padding:4px 8px;background:#34c759;margin:0;">🥚 Готовое</button>',
    '    </div>',
    '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">',
    '      <button class="tma-btn" id="admin-test-breed-ready" style="font-size:0.68rem;padding:6px 2px;margin:0;">⏩ Всё готово</button>',
    '      <button class="tma-btn" id="admin-test-breed-clear" style="font-size:0.68rem;padding:6px 2px;margin:0;">🧹 Пары+яйца</button>',
    '      <button class="tma-btn" id="admin-test-hasbred" style="font-size:0.68rem;padding:6px 2px;margin:0;">🍼 hasBred сброс</button>',
    '      <button class="tma-btn" id="admin-test-notif" style="font-size:0.68rem;padding:6px 2px;margin:0;">🔔 Тест-уведомл.</button>',
    '    </div>',
    '    <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">⚔️ Бой:</span>',
    '    <div style="display:flex;gap:4px;">',
    '      <input id="admin-test-wild" type="text" placeholder="дикий (пусто — рандом)" style="flex:1;padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">',
    '      <button class="tma-btn" id="admin-test-hunt-btn" style="font-size:0.68rem;padding:4px 8px;background:#ff9500;margin:0;">⚔️ Бой</button>',
    '    </div>',
    '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">',
    '      <button class="tma-btn" id="admin-test-heal" style="font-size:0.68rem;padding:6px 2px;margin:0;">❤️ Вылечить</button>',
    '      <button class="tma-btn" id="admin-test-battle-clear" style="font-size:0.68rem;padding:6px 2px;margin:0;">🧹 Сброс боя</button>',
    '    </div>',
    '    <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">📈 Прогресс:</span>',
    '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">',
    '      <button class="tma-btn" id="admin-test-lvl" style="font-size:0.68rem;padding:6px 2px;margin:0;">⭐ +5 уровней</button>',
    '      <button class="tma-btn" id="admin-test-money" style="font-size:0.68rem;padding:6px 2px;margin:0;">💰 +100k</button>',
    '      <button class="tma-btn" id="admin-test-ach" style="font-size:0.68rem;padding:6px 2px;margin:0;">🏆 Ачивки сброс</button>',
    '      <button class="tma-btn" id="admin-test-tut" style="font-size:0.68rem;padding:6px 2px;margin:0;">🎓 Туториал сброс</button>',
    '    </div>',
    '    <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">☁️ Сейвы:</span>',
    '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">',
    '      <button class="tma-btn" id="admin-test-sync" style="font-size:0.68rem;padding:6px 2px;margin:0;">☁️ Форс-синк</button>',
    '      <button class="tma-btn" id="admin-test-savestate" style="font-size:0.68rem;padding:6px 2px;margin:0;">📊 Статус сейва</button>',
    '    </div>',
    '  </div>',
    '</div>',
  ].join('\n');
  document.body.appendChild(modal);

  const tabBtns = modal.querySelectorAll('.admin-tab-btn');
  const tabContents = modal.querySelectorAll('.admin-tab-content');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => (c as HTMLElement).style.display = 'none');
      btn.classList.add('active');
      const target = modal.querySelector('#' + btn.getAttribute('data-tab')) as HTMLElement;
      if (target) target.style.display = 'flex';
    });
  });

  const editorStatus = document.getElementById('admin-editor-status')!;
  const editorFields = document.getElementById('admin-editor-fields')!;

  async function loadTrainer(id: number) {
    editorStatus.textContent = 'Loading...';
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'get_save', user: id }) });
      const data = await res.json();
      if (data.status !== 'ok') { editorStatus.textContent = '❌ ' + (data.error || 'Error'); return; }
      const sd = data.saveData || {};
      (document.getElementById('editor-nickname') as HTMLInputElement).value = sd.trainerNickname || sd.nickname || '';
      (document.getElementById('editor-money') as HTMLInputElement).value = String(sd.inventory?.credit ?? sd.money ?? 500);
      (document.getElementById('editor-badges') as HTMLInputElement).value = Array.isArray(sd.badges) ? sd.badges.join(', ') : '';
      if (sd.currentLocationId) (document.getElementById('editor-location') as HTMLSelectElement).value = sd.currentLocationId;
      (document.getElementById('editor-save-json') as HTMLTextAreaElement).value = JSON.stringify(sd, null, 2);
      editorStatus.textContent = '✅ Loaded (ID: ' + id + ')';
      editorFields.style.display = 'flex';
    } catch (e) {
      console.error('[admin] loadTrainer', e);
      editorStatus.textContent = '❌ Load error';
    }
  }

  document.getElementById('admin-editor-self')!.addEventListener('click', () => {
    const myId = getTgUser()?.id;
    if (!myId) { showToast('Could not get own ID', true); return; }
    (document.getElementById('admin-editor-id') as HTMLInputElement).value = String(myId);
    loadTrainer(myId);
  });

  document.getElementById('admin-editor-load')!.addEventListener('click', () => {
    const id = parseInt((document.getElementById('admin-editor-id') as HTMLInputElement).value);
    if (!id) { showToast('Enter ID', true); return; }
    loadTrainer(id);
  });

  document.getElementById('admin-editor-save')!.addEventListener('click', async () => {
    const id = parseInt((document.getElementById('admin-editor-id') as HTMLInputElement).value);
    if (!id) { showToast('Enter ID', true); return; }
    let currentData: any;
    try {
      currentData = JSON.parse((document.getElementById('editor-save-json') as HTMLTextAreaElement).value);
    } catch { showToast('Invalid JSON', true); return; }
    currentData.trainerNickname = (document.getElementById('editor-nickname') as HTMLInputElement).value.trim();
    const moneyVal = parseInt((document.getElementById('editor-money') as HTMLInputElement).value) || 0;
    if (!currentData.inventory) currentData.inventory = {};
    currentData.inventory.credit = moneyVal;
    const badgesStr = (document.getElementById('editor-badges') as HTMLInputElement).value.trim();
    currentData.badges = badgesStr ? badgesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const loc = (document.getElementById('editor-location') as HTMLSelectElement).value;
    currentData.currentLocationId = loc;
    const JOHTO_LOCATIONS = new Set(['goldenrodCity', 'ecruteakCity', 'olivineCity', 'cianwoodCity', 'azaleaTown', 'violetCity', 'blackthornCity']);
    currentData.currentRegion = JOHTO_LOCATIONS.has(loc) ? 'johto' : 'kanto';

    editorStatus.textContent = 'Saving...';
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'edit_trainer', user: id, val: JSON.stringify(currentData) }) });
      const data = await res.json();
      if (data.status === 'ok') {
        showToast('✅ Saved!', false);
        editorStatus.textContent = '✅ Saved';
        (document.getElementById('editor-save-json') as HTMLTextAreaElement).value = JSON.stringify(currentData, null, 2);
      } else {
        showToast('❌ ' + (data.error || 'Error'), true);
        editorStatus.textContent = '❌ Save error';
      }
    } catch (e) {
      console.error('[admin] edit_trainer', e);
      showToast('API Error', true);
      editorStatus.textContent = '❌ API Error';
    }
  });

  let adminSelectPopulated = false;
  const targetInfo = document.getElementById('admin-target-info')!;

  fab.addEventListener('click', async () => {
    modal.style.display = 'flex';
    const select = document.getElementById('admin-user-select') as HTMLSelectElement;
    if (!adminSelectPopulated) {
      adminSelectPopulated = true;
      // Register change listener regardless of fetch outcome
      select.addEventListener('change', () => {
        if (select.value) {
          (document.getElementById('admin-target-id') as HTMLInputElement).value = select.value;
          (document.getElementById('admin-lookup') as HTMLButtonElement).click();
        }
      });
      try {
        const res = await apiFetch('/profile/trainers/all');
        const data = await res.json();
        if (data.users) {
          data.users.forEach((u: any) => {
            const opt = document.createElement('option');
            opt.value = u.id; opt.textContent = (u.first_name || u.username || '?') + ' (ID:' + u.id + ')';
            select.appendChild(opt);
          });
        }
      } catch (e) { console.error('[admin] trainers list', e); }
    }
  });

  document.getElementById('admin-lookup')!.addEventListener('click', async () => {
    const id = (document.getElementById('admin-target-id') as HTMLInputElement).value.trim();
    if (!id) { targetInfo.textContent = 'Enter ID'; return; }
    targetInfo.textContent = 'Searching...';
    try {
      const res = await apiFetch('/profile/' + id);
      const data = await res.json();
      if (data.profile) {
        const p = data.profile;
        const pName = (p.first_name || p.username || '?').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        targetInfo.innerHTML = '👤 ' + pName + ' | 🏅' + escapeHtml(String(p.badges)) + ' | 💰' + (p.money ?? '?') + ' | 🐾' + (p.team?.length || 0);
        targetInfo.setAttribute('data-found', id);
      } else {
        targetInfo.textContent = 'Not found'; targetInfo.removeAttribute('data-found');
      }
    } catch (e) { console.error('[admin] lookup', e); targetInfo.textContent = 'Error'; }
  });

  document.querySelectorAll('.admin-id-act').forEach(btn => {
    btn.addEventListener('click', async () => {
      const found = targetInfo.getAttribute('data-found');
      if (!found) { showToast('First 🔍 find a trainer by ID', true); return; }
      const act = btn.getAttribute('data-act');
      const cmdMap: Record<string, string> = {
        money: 'give_money', badges: 'give_badges',
        heal: 'heal_team', lvl50: 'fix_levels', reset: 'reset_save',
      };
      const cmd = cmdMap[act!] || act!;
      try {
        const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd, user: parseInt(found) }) });
        const data = await res.json();
        showToast(data.status === 'ok' ? '✅ Done' : '❌ ' + (data.error || 'error'), data.status !== 'ok');
      } catch (e) { console.error('[admin] cmd', e); showToast('API Error', true); }
    });
  });

  document.getElementById('admin-give-item-btn')!.addEventListener('click', async () => {
    const found = targetInfo.getAttribute('data-found');
    if (!found) { showToast('First 🔍 find a trainer by ID', true); return; }
    const itemId = (document.getElementById('admin-item-id') as HTMLInputElement).value.trim().toLowerCase();
    if (!itemId) { showToast('Enter item ID', true); return; }
    const qty = parseInt((document.getElementById('admin-item-qty') as HTMLInputElement).value) || 1;
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'give_items', user: parseInt(found), val: JSON.stringify({ itemId, qty }) }) });
      const data = await res.json();
      showToast(data.status === 'ok' ? '✅ ' + qty + 'x ' + itemId : '❌ ' + (data.error || 'error'), data.status !== 'ok');
    } catch (e) { console.error('[admin] give item', e); showToast('API Error', true); }
  });

  document.getElementById('admin-give-self-btn')!.addEventListener('click', async () => {
    const myId = getTgUser()?.id;
    if (!myId) { showToast('Could not get own ID', true); return; }
    const itemId = (document.getElementById('admin-item-id') as HTMLInputElement).value.trim().toLowerCase();
    if (!itemId) { showToast('Enter item ID', true); return; }
    const qty = parseInt((document.getElementById('admin-item-qty') as HTMLInputElement).value) || 1;
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'give_items', user: myId, val: JSON.stringify({ itemId, qty }) }) });
      const data = await res.json();
      showToast(data.status === 'ok' ? '✅ Self: ' + qty + 'x ' + itemId : '❌ ' + (data.error || 'error'), data.status !== 'ok');
    } catch (e) { console.error('[admin] give self', e); showToast('API Error', true); }
  });

  document.getElementById('admin-tp-btn')!.addEventListener('click', async () => {
    const found = targetInfo.getAttribute('data-found');
    if (!found) { showToast('First 🔍 find a trainer by ID', true); return; }
    const loc = (document.getElementById('admin-tp-loc') as HTMLSelectElement).value;
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'teleport', user: parseInt(found), val: loc }) });
      const data = await res.json();
      showToast(data.status === 'ok' ? '✅ Teleported' : '❌ Error', data.status !== 'ok');
    } catch (e) { console.error('[admin] tp', e); showToast('API Error', true); }
  });

  document.getElementById('admin-tp-self-btn')!.addEventListener('click', async () => {
    const myId = getTgUser()?.id;
    if (!myId) { showToast('Could not get own ID', true); return; }
    const loc = (document.getElementById('admin-tp-loc') as HTMLSelectElement).value;
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'teleport', user: myId, val: loc }) });
      const data = await res.json();
      showToast(data.status === 'ok' ? '✅ Teleported' : '❌ Error', data.status !== 'ok');
    } catch (e) { console.error('[admin] tp self', e); showToast('API Error', true); }
  });

  document.getElementById('admin-spawn-btn')!.addEventListener('click', async () => {
    const species = (document.getElementById('admin-spawn-species') as HTMLInputElement).value.trim().toLowerCase();
    if (!species) { showToast('Enter pokemon name', true); return; }
    const level = parseInt((document.getElementById('admin-spawn-level') as HTMLInputElement).value) || 50;
    const shiny = (document.getElementById('admin-spawn-shiny') as HTMLInputElement).checked;
    const maxIV = (document.getElementById('admin-spawn-maxiv') as HTMLInputElement).checked;
    const natureIdx = parseInt((document.getElementById('admin-spawn-nature') as HTMLSelectElement).value);
    const trainingStage = parseInt((document.getElementById('admin-spawn-training') as HTMLSelectElement).value);
    const target = (document.getElementById('admin-spawn-target') as HTMLSelectElement).value;

    let userId: number;
    if (target === 'team' || target === 'pc') {
      const myId = getTgUser()?.id;
      if (!myId) { showToast('Could not get own ID', true); return; }
      userId = myId;
    } else {
      const found = targetInfo.getAttribute('data-found');
      if (!found) { showToast('First 🔍 find a trainer by ID', true); return; }
      userId = parseInt(found);
    }

    const val = JSON.stringify({ species, level, shiny, maxIV, natureIdx, trainingStage, target: target.endsWith('pc') ? 'pc' : 'team' });
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'add_mon', user: userId, val }) });
      const data = await res.json();
      showToast(data.status === 'ok' ? '✅ ' + species + ' (lvl ' + level + ')' : '❌ Error: ' + (data.error || ''), data.status !== 'ok');
    } catch (e) { console.error('[admin] spawn', e); showToast('API Error', true); }
  });

  document.getElementById('admin-broadcast-btn')!.addEventListener('click', async () => {
    const msg = (document.getElementById('admin-broadcast-msg') as HTMLTextAreaElement).value.trim();
    if (!msg) { showToast('Enter a message', true); return; }
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'broadcast', user: 1, val: msg }) });
      const data = await res.json();
      if (data.status === 'ok') {
        showToast('✅ Announcement sent', false);
        (document.getElementById('admin-broadcast-msg') as HTMLTextAreaElement).value = '';
      } else { showToast('❌ Error', true); }
    } catch (e) { console.error('[admin] broadcast', e); showToast('API Error', true); }
  });

  document.querySelectorAll('.admin-toggle-feature').forEach(btn => {
    btn.addEventListener('click', async () => {
      const feat = btn.getAttribute('data-feat');
      try {
        const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'toggle_feature', user: 1, val: feat }) });
        const data = await res.json();
        showToast(data.status === 'ok' ? '✅ ' + feat + ': ' + (data.enabled ? 'ON' : 'OFF') : '❌ Error', data.status !== 'ok');
      } catch (e) { console.error('[admin] toggle', e); showToast('API Error', true); }
    });
  });

  document.getElementById('btn-admin-close')!.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  // Вкладка Saves: список копий из save_history + восстановление.
  // Серверные команды save_history/restore_save существовали без UI.
  async function refreshSavesList() {
    const list = document.getElementById('admin-saves-list')!;
    const idRaw = (document.getElementById('admin-target-id') as HTMLInputElement).value.trim()
      || (document.getElementById('admin-editor-id') as HTMLInputElement).value.trim();
    const id = parseInt(idRaw);
    if (!id) { list.textContent = 'Укажи ID тренера (вкладка Commands или Editor)'; return; }
    list.textContent = 'Загрузка...';
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'save_history', user: id }) });
      const data = await res.json();
      if (data.status !== 'ok') { list.textContent = '❌ ' + (data.error || 'Error'); return; }
      list.innerHTML = '';
      const head = document.createElement('div');
      head.style.cssText = 'opacity:0.7;';
      head.textContent = `Сейчас: ${data.currentBroken ? 'БИТЫЙ' : data.currentPokemon + ' пок.'}`;
      list.appendChild(head);
      if (!data.copies || data.copies.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'Копий нет';
        list.appendChild(empty);
        return;
      }
      data.copies.forEach((c: any) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:4px;align-items:center;background:rgba(0,0,0,0.2);padding:4px 6px;border-radius:6px;';
        const label = document.createElement('span');
        label.style.flex = '1';
        const when = (c.createdAt || '').slice(0, 16).replace('T', ' ');
        label.textContent = `#${c.id} ${c.pokemon < 0 ? 'битая' : c.pokemon + ' пок.'} · ${c.reason || ''} · ${when}`;
        const btn = document.createElement('button');
        btn.className = 'tma-btn';
        btn.style.cssText = 'padding:4px 8px;font-size:0.68rem;background:#34c759;margin:0;';
        btn.textContent = '⏪ Вернуть';
        btn.onclick = async () => {
          if (!confirm(`Вернуть копию #${c.id} (${c.pokemon} пок.) тренеру ${id}? Текущий сейв сохранится в историю.`)) return;
          try {
            const r = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'restore_save', user: id, val: String(c.id) }) });
            const d = await r.json();
            showToast(d.status === 'ok' ? `✅ Возвращено (${d.restoredPokemon} пок.)` : '❌ ' + (d.error || 'error'), d.status !== 'ok');
            refreshSavesList();
          } catch (e) { console.error('[admin] restore', e); showToast('API Error', true); }
        };
        row.appendChild(label);
        row.appendChild(btn);
        list.appendChild(row);
      });
    } catch (e) { console.error('[admin] saves', e); list.textContent = '❌ API Error'; }
  }

  document.getElementById('admin-saves-refresh')!.addEventListener('click', refreshSavesList);

  // ── Test Lab: всё действует на СЕБЯ, всё реально работает ──
  const testStatus = document.getElementById('admin-test-status')!;
  const testSay = (msg: string, isErr = false) => {
    testStatus.textContent = msg;
    showToast(msg, isErr);
  };
  const selfId = (): number | null => {
    const id = getTgUser()?.id;
    if (!id) { testSay('Нет Telegram ID', true); return null; }
    return id;
  };
  const rndIV = () => ({
    hp: Math.floor(Math.random() * 32), atk: Math.floor(Math.random() * 32),
    def: Math.floor(Math.random() * 32), spa: Math.floor(Math.random() * 32),
    spd: Math.floor(Math.random() * 32), spe: Math.floor(Math.random() * 32),
  });

  // 🥚 Готовое яйцо: сразу идёт в вылупление реальным путём (hatchEgg → PokeAPI)
  document.getElementById('admin-test-egg-btn')!.addEventListener('click', async () => {
    const input = (document.getElementById('admin-test-egg') as HTMLInputElement).value.trim().toLowerCase();
    const all = GEN_STARTERS.flat();
    const species = input || all[Math.floor(Math.random() * all.length)];
    const egg = {
      uid: generateUID(), species,
      types: [{ type: { name: 'normal' } }],
      ivs: rndIV(), readyTime: Date.now(),
    };
    state.eggs.push(egg);
    testSay(`🥚 Яйцо ${species} добавлено, вылупляю...`);
    try {
      await hatchEgg(egg);
      testSay(`🥚 ${species} вылуплен (или яйцо в очереди)`);
    } catch (e) { testSay('❌ Ошибка вылупления', true); }
    autoSave();
  });

  // ⏩ Всё готово: пары и яйца созревают сейчас, прогон реального цикла
  document.getElementById('admin-test-breed-ready')!.addEventListener('click', async () => {
    const now = Date.now();
    state.breedingPairs.forEach((p: any) => { p.readyTime = now; });
    state.eggs.forEach((e: any) => { e.readyTime = now; });
    await checkBreeding().catch(() => {});
    autoSave();
    testSay(`⏩ Готово: пар ${state.breedingPairs.length}, яиц ${state.eggs.length}`);
  });

  // 🧹 Очистить пары и яйца
  document.getElementById('admin-test-breed-clear')!.addEventListener('click', () => {
    state.breedingPairs = [];
    state.eggs = state.eggs.filter((e: any) => e.boxIdx !== undefined);
    autoSave();
    testSay('🧹 Пары удалены, свободные яйца убраны');
  });

  // 🍼 hasBred сброс: команда + PC снова могут спариваться
  document.getElementById('admin-test-hasbred')!.addEventListener('click', () => {
    state.myTeam.forEach((m: any) => { m.hasBred = false; });
    state.pcBoxes.forEach((b: any) => (b || []).forEach((m: any) => { m.hasBred = false; }));
    autoSave();
    testSay('🍼 hasBred сброшен у всех');
  });

  // 🔔 Тест-уведомление
  document.getElementById('admin-test-notif')!.addEventListener('click', () => {
    addNotification('🔔 Тест', 'Проверка уведомлений: ' + new Date().toLocaleTimeString('ru'));
    testSay('🔔 Отправлено, смотри колокол');
  });

  // ⚔️ Дикий бой: вид из поля или случайный с локации
  document.getElementById('admin-test-hunt-btn')!.addEventListener('click', async () => {
    const input = (document.getElementById('admin-test-wild') as HTMLInputElement).value.trim().toLowerCase();
    try {
      const bc: any = await import('../battle/core.js');
      let name = input;
      if (!name) {
        const enc = bc.getLocationEncounters();
        if (!enc.length) { testSay('❌ На локации нет энкаунтеров', true); return; }
        name = bc.pickWeightedEncounter(enc);
      }
      modal.style.display = 'none';
      await bc.startHunt([name]);
      testSay(`⚔️ Бой: ${name}`);
    } catch (e) { testSay('❌ Не вышло начать бой', true); }
  });

  // ❤️ Вылечить команду полностью
  document.getElementById('admin-test-heal')!.addEventListener('click', () => {
    state.myTeam.forEach((m: any) => {
      m.currentHp = m.maxHp;
      m.status = null;
      m.sleepTurns = 0;
      m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    });
    store.emit('team:render');
    autoSave();
    testSay('❤️ Команда вылечена');
  });

  // 🧹 Сбросить бой: стейт + модалка
  document.getElementById('admin-test-battle-clear')!.addEventListener('click', async () => {
    try {
      const bc: any = await import('../battle/core.js');
      bc.clearBattleState();
    } catch { /* ключ всё равно чистим ниже */ }
    try { localStorage.removeItem(lsKey('battle_state')); } catch {}
    const m = document.getElementById('encounter-modal');
    if (m) m.style.display = 'none';
    const e = document.getElementById('battle-end-menu');
    if (e) e.style.display = 'none';
    testSay('🧹 Бой сброшен');
  });

  // ⭐ +5 уровней команде (пересчёт HP по формуле)
  document.getElementById('admin-test-lvl')!.addEventListener('click', async () => {
    try {
      const bc: any = await import('../battle/core.js');
      state.myTeam.forEach((m: any) => {
        m.baseLevel = Math.min(100, (m.baseLevel || 1) + 5);
        m.exp = Math.pow(m.baseLevel, 3);
        m.expToNext = Math.pow(m.baseLevel + 1, 3);
        const oldMax = m.maxHp;
        m.maxHp = bc.calculateStat(m, 'hp', false);
        m.currentHp = Math.min(m.maxHp, m.currentHp + (m.maxHp - oldMax));
      });
      store.emit('team:render');
      autoSave();
      testSay('⭐ +5 уровней команде');
    } catch (e) { testSay('❌ Ошибка прокачки', true); }
  });

  // 💰 +100k себе через сервер
  document.getElementById('admin-test-money')!.addEventListener('click', async () => {
    const id = selfId();
    if (!id) return;
    try {
      const res = await apiFetch('/admin/api', { method: 'POST', body: JSON.stringify({ cmd: 'give_money', user: id }) });
      const data = await res.json();
      testSay(data.status === 'ok' ? '✅ +100k (синкнись: облако уже обновлено)' : '❌ ' + (data.error || 'error'), data.status !== 'ok');
    } catch (e) { testSay('❌ API Error', true); }
  });

  // 🏆 Сброс ачивок
  document.getElementById('admin-test-ach')!.addEventListener('click', () => {
    setUnlockedAchievements([]);
    autoSave();
    testSay('🏆 Ачивки сброшены');
  });

  // 🎓 Сброс туториала (квесты проф. Оука заново)
  document.getElementById('admin-test-tut')!.addEventListener('click', () => {
    state.tutorialStep = 1;
    state.completedNPCQuests = (state.completedNPCQuests || []).filter((q: string) => !q.startsWith('tutorial_'));
    Object.keys(state.npcQuestProgress || {}).forEach((k) => {
      if (k.startsWith('tutorial_')) delete state.npcQuestProgress[k];
    });
    autoSave();
    testSay('🎓 Туториал сброшен на шаг 1');
  });

  // ☁️ Форс-синк в облако
  document.getElementById('admin-test-sync')!.addEventListener('click', () => {
    autoSave();
    testSay('☁️ Синк запущен (смотри значок ☁️)');
  });

  // 📊 Статус сейва одной строкой
  document.getElementById('admin-test-savestate')!.addEventListener('click', () => {
    const pc = (state.pcBoxes || []).reduce((n: number, b: any) => n + (b?.length || 0), 0);
    let battle = 'нет';
    try { battle = localStorage.getItem(lsKey('battle_state')) ? 'есть' : 'нет'; } catch {}
    testSay(`📊 v${state.saveVersion ?? '?'} sync=${state.lastCloudSync ? new Date(state.lastCloudSync).toLocaleTimeString('ru') : '—'} dirty=${!!state.saveDirty} | team ${state.myTeam.length} pc ${pc} | бой: ${battle} | ачивки: ${(state.achievements || []).length}`);
  });
}

function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
