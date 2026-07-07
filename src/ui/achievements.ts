// ─────────────────────────────────────────────────────────────
// achievements.ts — ДОСТИЖЕНИЯ
// ─────────────────────────────────────────────────────────────
// Модальное окно со списком всех достижений и их статусом
// (разблокировано/заблокировано) для текущего игрока.
//
// ЗАВИСИМОСТИ: нет (только глобальный DOM)
//
// ИСПОЛЬЗУЕТСЯ В: init.ts (кнопка "Достижения")
//
// ЭКСПОРТЫ:
//   openAchievements()        — открыть модалку достижений
//   setUnlockedAchievements() — загрузить список разблокированных
//   isAchievementUnlocked()   — проверить статус достижения
// ─────────────────────────────────────────────────────────────

// ── СПИСОК ВСЕХ ДОСТИЖЕНИЙ ──────────────────────────────
// Каждое: { id, icon, name, desc }
const ACHIEVEMENTS = [
  { id: 'first_catch', icon: '🔴', name: 'Первая поимка', desc: 'Поймайте первого дикого покемона' },
  { id: 'team_6', icon: '🐾', name: 'Полная команда', desc: 'Соберите команду из 6 покемонов' },
  { id: 'beat_gym', icon: '🏅', name: 'Первая победа', desc: 'Победите первого лидера гима' },
  { id: 'beat_elite', icon: '👑', name: 'Покоритель Элиты', desc: 'Победите Элитную Четверку' },
  { id: 'beat_champion', icon: '🏆', name: 'Чемпион', desc: 'Победите Чемпиона Лиги' },
  { id: 'money_100k', icon: '💰', name: 'Богач', desc: 'Заработайте ¥100,000' },
  { id: 'dex_50', icon: '📖', name: 'Коллекционер', desc: '50 видов в Покедексе' },
  { id: 'dex_100', icon: '📚', name: 'Профессор', desc: '100 видов в Покедексе' },
  { id: 'dex_all', icon: '🌟', name: 'Мастер Покедекса', desc: 'Полный Покедекс' },
  { id: 'explorer', icon: '🗺️', name: 'Исследователь', desc: 'Посетите 20 локаций' },
  { id: 'breeder', icon: '🥚', name: 'Заводчик', desc: 'Вылупите первое яйцо' },
  { id: 'trainer_100', icon: '⚔️', name: 'Ветеран', desc: '100 побед в битвах' },
  { id: 'pvp_win', icon: '⚡', name: 'PvP Победитель', desc: 'Первая победа в PvP' },
  { id: 'shiny_catch', icon: '✨', name: 'Охотник за Шайни', desc: 'Поймайте шайни покемона' },
];  // 14 достижений

// ── СОСТОЯНИЕ: разблокированные достижения (кэш в памяти) ──
let unlockedAchievements: string[] = [];

// ── setUnlockedAchievements: установить список разблокированных ──
// Принимает массив ID достижений (загружается с сервера)
export function setUnlockedAchievements(ids: string[]) {
  unlockedAchievements = ids;
}

// ── isAchievementUnlocked: проверить, разблокировано ли ──
export function isAchievementUnlocked(id: string): boolean {
  return unlockedAchievements.includes(id);
}

// ── openAchievements: открыть модальное окно достижений ──
// Показывает все 14 достижений с иконками, названиями и описанием
// Разблокированные — цветные, заблокированные — серые
// Вверху счётчик: "Получено: 5/14"
export function openAchievements() {
  // Удаляем старую модалку (если есть)
  document.querySelectorAll('.achievement-modal').forEach(el => el.remove());

  const modal = document.createElement('div');
  modal.className = 'help-modal achievement-modal';  // Используем стили help-modal

  modal.innerHTML = `
    <div class="help-card" style="max-width:380px;">
      <h2>🏆 Достижения</h2>
      <!-- Счётчик -->
      <div style="margin-bottom:12px;font-size:0.82rem;color:#999;">
        Получено: ${unlockedAchievements.length}/${ACHIEVEMENTS.length}
      </div>
      <!-- Сетка достижений -->
      <div class="achievement-grid">
        ${ACHIEVEMENTS.map(a => {
          const unlocked = unlockedAchievements.includes(a.id);
          return `
            <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
              <span class="achievement-icon">${a.icon}</span>
              <div style="font-weight:${unlocked ? '600' : '400'};color:${unlocked ? '#fff' : '#666'}">${a.name}</div>
              <div style="font-size:0.65rem;color:#777;margin-top:2px;">${a.desc}</div>
            </div>
          `;
        }).join('')}
      </div>
      <!-- Кнопка закрытия -->
      <div style="text-align:center;margin-top:14px;">
        <button class="tutorial-btn tutorial-btn-secondary" id="ach-close">Закрыть</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Обработчик закрытия
  document.getElementById('ach-close')?.addEventListener('click', () => modal.remove());
}
