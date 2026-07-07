// ─────────────────────────────────────────────────────────────
// admin.ts — АДМИНИСТРАТИВНАЯ ПАНЕЛЬ (СЕРВЕРНАЯ)
// ─────────────────────────────────────────────────────────────
// Три вкладки:
//   «Тренер» — редактор тренера (себя или другого): ник, деньги,
//              значки, локация, save_data, предметы, покемоны
//   «Игроки» — поиск, быстрые команды, телепорт, спавн
//   «Сервер» — глобальные анонсы, переключение фич
//
// Все действия идут через сервер — ничего в локальном state.
// ─────────────────────────────────────────────────────────────

import { getIsAdmin, getTgUser } from '../game/getters.js';
import { showToast } from '../utils/dom.js';

// ── initAdminPanel: создание админ-панели ───────────────
export function initAdminPanel() {
  if (!getIsAdmin()) return;

  // ── FAB-КНОПКА ──
  const fab = document.createElement('button');
  fab.id = 'admin-fab';
  fab.innerHTML = '🛠';
  fab.title = 'Админ-панель';
  fab.style.cssText = 'position:fixed;bottom:120px;right:16px;width:48px;height:48px;border-radius:50%;background:#af52de;color:#fff;border:none;font-size:1.4rem;z-index:250;box-shadow:0 4px 12px rgba(0,0,0,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;';
  document.body.appendChild(fab);

  // ── МОДАЛЬНОЕ ОКНО ──
  const modal = document.createElement('div');
  modal.id = 'admin-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="selection-modal-card" style="max-width:420px;width:95%;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:12px;">
      <!-- Заголовок -->
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--tma-border);padding-bottom:6px;">
        <h3 style="margin:0;">🛠 Админка</h3>
        <button class="tma-btn" id="btn-admin-close" style="padding:4px 8px;font-size:0.75rem;margin:0;background:#ff3b30;">❌</button>
      </div>

      <!-- Вкладки -->
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--tma-border);padding-bottom:4px;">
        <button class="tma-btn admin-tab-btn active" data-tab="tab-editor" style="flex:1;font-size:0.75rem;padding:6px 2px;margin:0;">✏️ Редактор</button>
        <button class="tma-btn admin-tab-btn" data-tab="tab-players" style="flex:1;font-size:0.75rem;padding:6px 2px;margin:0;">⚡ Команды</button>
        <button class="tma-btn admin-tab-btn" data-tab="tab-server" style="flex:1;font-size:0.75rem;padding:6px 2px;margin:0;">🌐 Сервер</button>
      </div>

      <!-- Вкладка "Редактор" — полный редактор тренера -->
      <div id="tab-editor" class="admin-tab-content" style="display:flex;flex-direction:column;gap:4px;">
        <!-- Выбор тренера -->
        <div style="display:flex;gap:4px;align-items:center;">
          <span style="font-size:0.75rem;font-weight:bold;color:var(--tma-text-muted);">Тренер:</span>
          <input id="admin-editor-id" type="text" placeholder="Telegram ID" style="flex:1;padding:5px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);">
          <button class="tma-btn" id="admin-editor-load" style="padding:5px 10px;font-size:0.7rem;background:#007aff;margin:0;">📥 Загрузить</button>
          <button class="tma-btn" id="admin-editor-self" style="padding:5px 10px;font-size:0.7rem;background:#af52de;margin:0;">🙋 Себя</button>
        </div>
        <div id="admin-editor-status" style="font-size:0.7rem;color:var(--tma-text-muted);background:rgba(0,0,0,0.2);padding:5px 8px;border-radius:6px;min-height:22px;">Введите ID или нажмите «Себя»</div>
        <!-- Поля редактора (пока скрыты, показываются после загрузки) -->
        <div id="admin-editor-fields" style="display:none;flex-direction:column;gap:4px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">Никнейм
              <input id="editor-nickname" type="text" style="padding:4px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
            </label>
            <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">Деньги (¥)
              <input id="editor-money" type="number" min="0" style="padding:4px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
            </label>
          </div>
          <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">Значки (через запятую)
            <input id="editor-badges" type="text" placeholder="Boulder Badge, Cascade Badge, ..." style="padding:4px;font-size:0.72rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
          </label>
          <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">Локация
            <select id="editor-location" style="padding:4px;font-size:0.72rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
              <option value="pewterCity">Pewter City</option><option value="ceruleanCity">Cerulean City</option>
              <option value="vermilionCity">Vermilion City</option><option value="celadonCity">Celadon City</option>
              <option value="lavenderTown">Lavender Town</option><option value="saffronCity">Saffron City</option>
              <option value="fuschiaCity">Fuschia City</option><option value="cinnabarIsland">Cinnabar Island</option>
              <option value="goldenrodCity">Goldenrod City</option><option value="ecruteakCity">Ecruteak City</option>
              <option value="olivineCity">Olivine City</option><option value="cianwoodCity">Cianwood City</option>
              <option value="azaleaTown">Azalea Town</option><option value="violetCity">Violet City</option>
              <option value="blackthornCity">Blackthorn City</option>
            </select>
          </label>
          <label style="font-size:0.65rem;display:flex;flex-direction:column;gap:1px;color:var(--tma-text-muted);">save_data (JSON) — можно редактировать любые поля
            <textarea id="editor-save-json" rows="8" style="width:100%;padding:4px;font-size:0.65rem;font-family:monospace;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);resize:vertical;"></textarea>
          </label>
          <button class="tma-btn" id="admin-editor-save" style="width:100%;padding:8px;font-size:0.8rem;background:#34c759;margin:0;">💾 Сохранить</button>
        </div>
      </div>

      <!-- Вкладка "Команды" — быстрые серверные команды -->
      <div id="tab-players" class="admin-tab-content" style="display:none;flex-direction:column;gap:6px;">
        <!-- Поиск тренера -->
        <div style="display:flex;gap:4px;">
          <select id="admin-user-select" style="flex:1.2;padding:6px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);"><option value="">— Выбрать тренера —</option></select>
          <input id="admin-target-id" type="text" placeholder="или ID" style="flex:0.8;padding:6px 8px;font-size:0.75rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);">
          <button class="tma-btn" id="admin-lookup" style="padding:6px 10px;font-size:0.75rem;background:#007aff;margin:0;">🔍</button>
        </div>
        <div id="admin-target-info" style="font-size:0.72rem;color:var(--tma-text-muted);background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;min-height:28px;">Сначала найдите или выберите игрока</div>
        <!-- Кнопки быстрых команд -->
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:4px;">
          <button class="tma-btn admin-id-act" data-act="money" style="font-size:0.68rem;padding:6px 2px;background:#ff9500;margin:0;">💰 +100к ¥</button>
          <button class="tma-btn admin-id-act" data-act="badges" style="font-size:0.68rem;padding:6px 2px;background:#ff3b30;margin:0;">🏅 Значки</button>
          <button class="tma-btn admin-id-act" data-act="heal" style="font-size:0.68rem;padding:6px 2px;background:#007aff;margin:0;">🏥 Лечить</button>
          <button class="tma-btn admin-id-act" data-act="lvl50" style="font-size:0.68rem;padding:6px 2px;background:#5856d6;margin:0;">📈 До 50 lvl</button>
          <button class="tma-btn admin-id-act" data-act="reset" style="font-size:0.68rem;padding:6px 2px;background:#ff3b30;margin:0;">💣 Сброс сэйва</button>
        </div>
        <!-- Выдача предмета -->
        <div style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--tma-border);padding-top:4px;">
          <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">🎒 Выдать предмет:</span>
          <div style="display:flex;gap:4px;">
            <input id="admin-item-id" type="text" placeholder="id (ultraBall)" style="flex:1;padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
            <input id="admin-item-qty" type="number" value="999" min="1" max="9999" style="width:60px;padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
            <button class="tma-btn" id="admin-give-item-btn" style="font-size:0.68rem;padding:4px 8px;background:#34c759;margin:0;">👤 Выдать</button>
            <button class="tma-btn" id="admin-give-self-btn" style="font-size:0.68rem;padding:4px 8px;background:#af52de;margin:0;">🙋 Себе</button>
          </div>
        </div>
        <!-- Телепорт -->
        <div style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--tma-border);padding-top:4px;">
          <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">🗺️ Телепорт:</span>
          <div style="display:flex;gap:4px;">
            <select id="admin-tp-loc" style="flex:1;padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
              <option value="pewterCity">Pewter City</option><option value="ceruleanCity">Cerulean City</option>
              <option value="vermilionCity">Vermilion City</option><option value="celadonCity">Celadon City</option>
              <option value="lavenderTown">Lavender Town</option><option value="saffronCity">Saffron City</option>
              <option value="fuschiaCity">Fuschia City</option><option value="cinnabarIsland">Cinnabar Island</option>
              <option value="goldenrodCity">Goldenrod City</option><option value="ecruteakCity">Ecruteak City</option>
              <option value="olivineCity">Olivine City</option><option value="cianwoodCity">Cianwood City</option>
              <option value="azaleaTown">Azalea Town</option><option value="violetCity">Violet City</option>
              <option value="blackthornCity">Blackthorn City</option>
            </select>
            <button class="tma-btn" id="admin-tp-btn" style="padding:4px 10px;font-size:0.68rem;background:#5ac8fa;margin:0;">👤 ТП</button>
            <button class="tma-btn" id="admin-tp-self-btn" style="padding:4px 8px;font-size:0.68rem;background:#af52de;margin:0;">🙋 Себе</button>
          </div>
        </div>
        <!-- Спавн покемона -->
        <div style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--tma-border);padding-top:4px;">
          <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">✨ Спавн покемона:</span>
          <select id="admin-spawn-target" style="padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
            <option value="team">Себе — в команду</option><option value="pc">Себе — в PC</option><option value="target_team">Тренеру (ID) — в команду</option><option value="target_pc">Тренеру (ID) — в PC</option>
          </select>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">
            <input id="admin-spawn-species" type="text" placeholder="вид (pikachu)" style="padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
            <input id="admin-spawn-level" type="number" placeholder="lvl" value="50" min="1" max="100" style="padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
          </div>
          <select id="admin-spawn-nature" style="padding:4px;font-size:0.68rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);">
            <option value="-1">🎲 Случайный характер</option>
            <option value="0">Hardy (Твёрдый)</option><option value="1">Lonely</option><option value="2">Brave</option><option value="3">Adamant</option>
            <option value="4">Naughty</option><option value="5">Bold</option><option value="6">Docile</option><option value="7">Relaxed</option>
            <option value="8">Impish</option><option value="9">Lax</option><option value="10">Timid</option><option value="11">Hasty</option>
            <option value="12">Serious</option><option value="13">Jolly</option><option value="14">Naive</option><option value="15">Modest</option>
            <option value="16">Mild</option><option value="17">Quiet</option><option value="18">Bashful</option><option value="19">Rash</option>
            <option value="20">Calm</option><option value="21">Gentle</option><option value="22">Sassy</option><option value="23">Careful</option>
            <option value="24">Quirky</option>
          </select>
          <div style="display:flex;gap:3px;align-items:center;flex-wrap:wrap;">
            <label style="font-size:0.62rem;display:flex;align-items:center;gap:2px;color:var(--tma-text);"><input id="admin-spawn-shiny" type="checkbox"> Шайни</label>
            <label style="font-size:0.62rem;display:flex;align-items:center;gap:2px;color:var(--tma-text);"><input id="admin-spawn-maxiv" type="checkbox" checked> Макс IV</label>
            <select id="admin-spawn-training" style="padding:3px;font-size:0.62rem;border:1px solid var(--tma-border);border-radius:4px;background:var(--tma-bg);color:var(--tma-text);flex:1;">
              <option value="0">🎽 Нет</option><option value="1">Начальная</option><option value="2">Расширенная</option>
              <option value="3">Мастерская</option><option value="4">Знаменитая</option>
            </select>
          </div>
          <button class="tma-btn" id="admin-spawn-btn" style="width:100%;padding:6px;font-size:0.75rem;background:#34c759;margin:1px 0 0;">✨ Спавнить</button>
        </div>
      </div>

      <!-- Вкладка "Сервер" — анонсы и фичи -->
      <div id="tab-server" class="admin-tab-content" style="display:none;flex-direction:column;gap:6px;">
        <div><span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">📢 Глобальный анонс:</span>
          <textarea id="admin-broadcast-msg" placeholder="Сообщение для всех игроков..." style="width:100%;height:60px;padding:6px;font-size:0.72rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);font-family:monospace;resize:none;"></textarea>
          <button class="tma-btn" id="admin-broadcast-btn" style="width:100%;padding:8px;font-size:0.75rem;background:#af52de;margin:0;">📢 Отправить</button>
        </div>
        <div style="border-top:1px solid var(--tma-border);padding-top:6px;">
          <span style="font-size:0.7rem;font-weight:bold;color:var(--tma-text-muted);">⚙️ Переключить фичи:</span>
          <div style="display:grid;grid-template-columns:1fr;gap:4px;margin-top:4px;">
            <button class="tma-btn admin-toggle-feature" data-feat="double_exp" style="font-size:0.7rem;padding:6px;margin:0;background:#ff9500;">📈 Double EXP</button>
            <button class="tma-btn admin-toggle-feature" data-feat="beta_mode" style="font-size:0.7rem;padding:6px;margin:0;background:#007aff;">🧪 Beta Mode</button>
            <button class="tma-btn admin-toggle-feature" data-feat="shiny_boost" style="font-size:0.7rem;padding:6px;margin:0;background:#34c759;">✨ Shiny Boost (x10)</button>
            <button class="tma-btn admin-toggle-feature" data-feat="free_shop" style="font-size:0.7rem;padding:6px;margin:0;background:#ff3b30;">🛍️ Free Shop</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // ── ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ──
  const tabBtns = modal.querySelectorAll('.admin-tab-btn');
  const tabContents = modal.querySelectorAll('.admin-tab-content');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => (c as HTMLElement).style.display = 'none');
      btn.classList.add('active');
      const target = modal.querySelector(`#${btn.getAttribute('data-tab')}`) as HTMLElement;
      if (target) target.style.display = 'flex';
    });
  });

  // ── РЕДАКТОР ТРЕНЕРА ──
  const editorStatus = document.getElementById('admin-editor-status')!;
  const editorFields = document.getElementById('admin-editor-fields')!;

  async function loadTrainer(id: number) {
    editorStatus.textContent = 'Загрузка...';
    try {
      const res = await fetch(`/admin/api?token=league17admin2026&cmd=get_save&user=${id}`);
      const data = await res.json();
      if (data.status !== 'ok') { editorStatus.textContent = '❌ ' + (data.error || 'Ошибка'); return; }
      const sd = data.saveData || {};
      // Заполняем поля
      (document.getElementById('editor-nickname') as HTMLInputElement).value = sd.trainerNickname || sd.nickname || '';
      (document.getElementById('editor-money') as HTMLInputElement).value = String(sd.inventory?.credit ?? sd.money ?? 500);
      (document.getElementById('editor-badges') as HTMLInputElement).value = Array.isArray(sd.badges) ? sd.badges.join(', ') : '';
      if (sd.currentLocationId) (document.getElementById('editor-location') as HTMLSelectElement).value = sd.currentLocationId;
      (document.getElementById('editor-save-json') as HTMLTextAreaElement).value = JSON.stringify(sd, null, 2);
      editorStatus.textContent = `✅ Загружен (ID: ${id})`;
      editorFields.style.display = 'flex';
    } catch (e) {
      editorStatus.textContent = '❌ Ошибка загрузки';
    }
  }

  document.getElementById('admin-editor-self')!.addEventListener('click', () => {
    const myId = getTgUser()?.id;
    if (!myId) { showToast('Не удалось определить свой ID', true); return; }
    (document.getElementById('admin-editor-id') as HTMLInputElement).value = String(myId);
    loadTrainer(myId);
  });

  document.getElementById('admin-editor-load')!.addEventListener('click', () => {
    const id = parseInt((document.getElementById('admin-editor-id') as HTMLInputElement).value);
    if (!id) { showToast('Введите ID', true); return; }
    loadTrainer(id);
  });

  document.getElementById('admin-editor-save')!.addEventListener('click', async () => {
    const id = parseInt((document.getElementById('admin-editor-id') as HTMLInputElement).value);
    if (!id) { showToast('Введите ID', true); return; }
    // Собираем изменения
    let currentData: any;
    try {
      currentData = JSON.parse((document.getElementById('editor-save-json') as HTMLTextAreaElement).value);
    } catch { showToast('Некорректный JSON', true); return; }
    // Проставляем поля из формы
    currentData.trainerNickname = (document.getElementById('editor-nickname') as HTMLInputElement).value.trim();
    const moneyVal = parseInt((document.getElementById('editor-money') as HTMLInputElement).value) || 0;
    if (!currentData.inventory) currentData.inventory = {};
    currentData.inventory.credit = moneyVal;
    const badgesStr = (document.getElementById('editor-badges') as HTMLInputElement).value.trim();
    currentData.badges = badgesStr ? badgesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const loc = (document.getElementById('editor-location') as HTMLSelectElement).value;
    currentData.currentLocationId = loc;
    currentData.currentRegion = loc.includes('goldenrod') || loc.includes('ecruteak') || loc.includes('olivine') || loc.includes('cianwood') || loc.includes('azalea') || loc.includes('violet') || loc.includes('blackthorn') ? 'johto' : 'kanto';

    editorStatus.textContent = 'Сохранение...';
    try {
      const res = await fetch(`/admin/api?token=league17admin2026&cmd=edit_trainer&user=${id}&val=${encodeURIComponent(JSON.stringify(currentData))}`);
      const data = await res.json();
      if (data.status === 'ok') {
        showToast('✅ Сохранено!', false);
        editorStatus.textContent = '✅ Сохранено';
        // Возвращаем обновлённый JSON
        (document.getElementById('editor-save-json') as HTMLTextAreaElement).value = JSON.stringify(currentData, null, 2);
      } else {
        showToast('❌ ' + (data.error || 'Ошибка'), true);
        editorStatus.textContent = '❌ Ошибка сохранения';
      }
    } catch (e) {
      showToast('Ошибка API', true);
      editorStatus.textContent = '❌ Ошибка API';
    }
  });

  // ── ЗАГРУЗКА СПИСКА ТРЕНЕРОВ ──
  let adminSelectPopulated = false;
  const targetInfo = document.getElementById('admin-target-info')!;

  fab.addEventListener('click', async () => {
    modal.style.display = 'flex';
    const select = document.getElementById('admin-user-select') as HTMLSelectElement;
    if (!adminSelectPopulated) {
      adminSelectPopulated = true;
      try {
        const res = await fetch('/api/profile/trainers/all');
        const data = await res.json();
        if (data.users) {
          data.users.forEach((u: any) => {
            const opt = document.createElement('option');
            opt.value = u.id; opt.textContent = `${u.first_name || u.username || '?'} (ID:${u.id})`;
            select.appendChild(opt);
          });
        }
      } catch (e) { /* ignore */ }
      select.addEventListener('change', () => {
        if (select.value) {
          (document.getElementById('admin-target-id') as HTMLInputElement).value = select.value;
          (document.getElementById('admin-lookup') as HTMLButtonElement).click();
        }
      });
    }
  });

  // ── ПОИСК ТРЕНЕРА ──
  document.getElementById('admin-lookup')!.addEventListener('click', async () => {
    const id = (document.getElementById('admin-target-id') as HTMLInputElement).value.trim();
    if (!id) { targetInfo.textContent = 'Введите ID'; return; }
    targetInfo.textContent = 'Поиск...';
    try {
      const res = await fetch(`/api/profile/${id}`);
      const data = await res.json();
      if (data.profile) {
        const p = data.profile;
        targetInfo.innerHTML = `👤 ${p.first_name || p.username} | 🏅${p.badges} | 💰${p.money} | 🐾${p.team?.length || 0}`;
        targetInfo.setAttribute('data-found', id);
      } else {
        targetInfo.textContent = 'Не найден'; targetInfo.removeAttribute('data-found');
      }
    } catch (e) { targetInfo.textContent = 'Ошибка'; }
  });

  // ── КОМАНДЫ НАД ТРЕНЕРОМ ──
  document.querySelectorAll('.admin-id-act').forEach(btn => {
    btn.addEventListener('click', async () => {
      const found = targetInfo.getAttribute('data-found');
      if (!found) { showToast('Сначала 🔍 найди тренера по ID', true); return; }
      const act = btn.getAttribute('data-act');
      const cmdMap: Record<string, string> = {
        money: 'give_money', badges: 'give_badges',
        heal: 'heal_team', lvl50: 'fix_levels',
      };
      const cmd = cmdMap[act!] || act!;
      try {
        const url = `/admin/api?token=league17admin2026&cmd=${cmd}&user=${found}`;
        const res = await fetch(url); const data = await res.json();
        showToast(data.status === 'ok' ? '✅ Готово' : '❌ ' + (data.error || 'ошибка'), data.status !== 'ok');
      } catch (e) { showToast('Ошибка API', true); }
    });
  });

  // ── ВЫДАТЬ ПРЕДМЕТ ──
  document.getElementById("admin-give-item-btn")!.addEventListener("click", async () => {
    const found = targetInfo.getAttribute("data-found");
    if (!found) { showToast("Сначала 🔍 найди тренера по ID", true); return; }
    const itemId = (document.getElementById("admin-item-id") as HTMLInputElement).value.trim().toLowerCase();
    if (!itemId) { showToast("Введите id предмета", true); return; }
    const qty = parseInt((document.getElementById("admin-item-qty") as HTMLInputElement).value) || 1;
    try {
      const res = await fetch(`/admin/api?token=league17admin2026&cmd=give_items&user=${found}&val=${encodeURIComponent(JSON.stringify({ itemId, qty }))}`);
      const data = await res.json();
      showToast(data.status === "ok" ? `✅ ${qty}x ${itemId}` : "❌ " + (data.error || "ошибка"), data.status !== "ok");
    } catch (e) { showToast("Ошибка API", true); }
  });

  document.getElementById("admin-give-self-btn")!.addEventListener("click", async () => {
    const myId = getTgUser()?.id;
    if (!myId) { showToast("Не удалось определить свой ID", true); return; }
    const itemId = (document.getElementById("admin-item-id") as HTMLInputElement).value.trim().toLowerCase();
    if (!itemId) { showToast("Введите id предмета", true); return; }
    const qty = parseInt((document.getElementById("admin-item-qty") as HTMLInputElement).value) || 1;
    try {
      const res = await fetch(`/admin/api?token=league17admin2026&cmd=give_items&user=${myId}&val=${encodeURIComponent(JSON.stringify({ itemId, qty }))}`);
      const data = await res.json();
      showToast(data.status === "ok" ? `✅ Себе: ${qty}x ${itemId}` : "❌ " + (data.error || "ошибка"), data.status !== "ok");
    } catch (e) { showToast("Ошибка API", true); }
  });

  // ── ТЕЛЕПОРТ ──
  document.getElementById('admin-tp-btn')!.addEventListener('click', async () => {
    const found = targetInfo.getAttribute('data-found');
    if (!found) { showToast('Сначала 🔍 найди тренера по ID', true); return; }
    const loc = (document.getElementById('admin-tp-loc') as HTMLSelectElement).value;
    try {
      const res = await fetch(`/admin/api?token=league17admin2026&cmd=teleport&user=${found}&val=${encodeURIComponent(loc)}`);
      const data = await res.json();
      showToast(data.status === 'ok' ? '✅ Телепортирован' : '❌ Ошибка', data.status !== 'ok');
    } catch (e) { showToast('Ошибка API', true); }
  });

  document.getElementById("admin-tp-self-btn")!.addEventListener("click", async () => {
    const myId = getTgUser()?.id;
    if (!myId) { showToast("Не удалось определить свой ID", true); return; }
    const loc = (document.getElementById("admin-tp-loc") as HTMLSelectElement).value;
    try {
      const res = await fetch(`/admin/api?token=league17admin2026&cmd=teleport&user=${myId}&val=${encodeURIComponent(loc)}`);
      const data = await res.json();
      showToast(data.status === "ok" ? "✅ Телепортирован" : "❌ Ошибка", data.status !== "ok");
    } catch (e) { showToast("Ошибка API", true); }
  });

  // ── СПАВН ПОКЕМОНА ──
  document.getElementById('admin-spawn-btn')!.addEventListener('click', async () => {
    const species = (document.getElementById('admin-spawn-species') as HTMLInputElement).value.trim().toLowerCase();
    if (!species) { showToast('Введите название покемона', true); return; }
    const level = parseInt((document.getElementById('admin-spawn-level') as HTMLInputElement).value) || 50;
    const shiny = (document.getElementById('admin-spawn-shiny') as HTMLInputElement).checked;
    const maxIV = (document.getElementById('admin-spawn-maxiv') as HTMLInputElement).checked;
    const natureIdx = parseInt((document.getElementById('admin-spawn-nature') as HTMLSelectElement).value);
    const trainingStage = parseInt((document.getElementById('admin-spawn-training') as HTMLSelectElement).value);
    const target = (document.getElementById('admin-spawn-target') as HTMLSelectElement).value;

    let userId: number;
    if (target === 'team' || target === 'pc') {
      const myId = getTgUser()?.id;
      if (!myId) { showToast('Не удалось определить свой ID', true); return; }
      userId = myId;
    } else {
      const found = targetInfo.getAttribute('data-found');
      if (!found) { showToast('Сначала 🔍 найди тренера по ID', true); return; }
      userId = parseInt(found);
    }

    const val = JSON.stringify({ species, level, shiny, maxIV, natureIdx, trainingStage, target: target.endsWith('pc') ? 'pc' : 'team' });
    try {
      const res = await fetch(`/admin/api?token=league17admin2026&cmd=add_mon&user=${userId}&val=${encodeURIComponent(val)}`);
      const data = await res.json();
      showToast(data.status === 'ok' ? `✅ ${species} (lvl ${level})` : '❌ Ошибка: ' + (data.error || ''), data.status !== 'ok');
    } catch (e) { showToast('Ошибка API', true); }
  });

  // ── АНОНС ──
  document.getElementById('admin-broadcast-btn')!.addEventListener('click', async () => {
    const msg = (document.getElementById('admin-broadcast-msg') as HTMLTextAreaElement).value.trim();
    if (!msg) { showToast('Введите сообщение', true); return; }
    try {
      const res = await fetch(`/admin/api?token=league17admin2026&cmd=broadcast&user=1&val=${encodeURIComponent(msg)}`);
      const data = await res.json();
      if (data.status === 'ok') {
        showToast('✅ Анонс отправлен', false);
        (document.getElementById('admin-broadcast-msg') as HTMLTextAreaElement).value = '';
      } else { showToast('❌ Ошибка', true); }
    } catch (e) { showToast('Ошибка API', true); }
  });

  // ── ФИЧИ ──
  document.querySelectorAll('.admin-toggle-feature').forEach(btn => {
    btn.addEventListener('click', async () => {
      const feat = btn.getAttribute('data-feat');
      try {
        const res = await fetch(`/admin/api?token=league17admin2026&cmd=toggle_feature&user=1&val=${encodeURIComponent(feat!)}`);
        const data = await res.json();
        showToast(data.status === 'ok' ? `✅ ${feat}: ${data.enabled ? 'ВКЛ' : 'ВЫКЛ'}` : '❌ Ошибка', data.status !== 'ok');
      } catch (e) { showToast('Ошибка API', true); }
    });
  });

  // ── ЗАКРЫТИЕ ──
  document.getElementById('btn-admin-close')!.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
}
