// ─────────────────────────────────────────────────────────────
// avatars.ts — ПАК ГОТОВЫХ АВАТАРОК (блок G1)
// ─────────────────────────────────────────────────────────────
// НАБОР готовых аватарок БЕЗ загрузки файлов: тренеры разных
// характеров/типов/поз, с покемоном и без, боевые сцены.
//
// Реализация: SVG-аватарки генерируются кодом (inline-SVG) в едином
// плоском стиле: круглый бейдж 64×64, голова+плечи, волосы, аксессуар,
// эмблема типа, поза рук, опционально компаньон-покемон и боевые эффекты.
// Палитры/позы/атрибуты различаются, строки SVG уникальны.
//
// ИСПОЛЬЗУЕТСЯ В: ui/trainer-card.ts (сетка выбора), ui/trainers.ts
// (кружки в списках), game/auth.ts (регистрация — опционально).
// ─────────────────────────────────────────────────────────────

export interface AvatarDef {
  /** Машиночитаемый id: латиница/цифры/дефис. */
  id: string;
  /** Русское имя для сетки выбора. */
  name: string;
  /** Inline-SVG 64×64. */
  svg: string;
}

type HairStyle = 'short' | 'long' | 'spiky' | 'ponytail' | 'buzz' | 'curly' | 'hood' | 'cap';
type Accessory = 'none' | 'glasses' | 'headband' | 'earring' | 'scarf' | 'goggles';
type Companion = 'none' | 'pika' | 'bulb' | 'bird' | 'egg' | 'ghost';
type Pose = 'front' | 'side' | 'action';

interface AvatarCfg {
  id: string;
  bg: [string, string];
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  jacket: string;
  jacketDark: string;
  shirt: string;
  acc: Accessory;
  accColor: string;
  companion: Companion;
  battle: boolean;
  pose: Pose;
  emblem: string;
  mouth: 'smile' | 'flat' | 'grin';
}

// ── Вспомогательные кусочки SVG (единый стиль) ──

function hairSvg(style: HairStyle, hair: string): string {
  switch (style) {
    case 'short':
      return `<path d="M20 26 Q20 12 32 12 Q44 12 44 26 L42 22 Q40 16 32 16 Q24 16 22 22 Z" fill="${hair}"/>`;
    case 'long':
      return `<path d="M19 30 Q18 10 32 10 Q46 10 45 30 L43 40 L40 40 L41 24 Q39 15 32 15 Q25 15 23 24 L24 40 L21 40 Z" fill="${hair}"/>`;
    case 'spiky':
      return `<polygon points="20,26 16,14 24,18 26,8 31,16 36,6 38,16 46,12 42,22 44,28 38,22 32,24 26,22" fill="${hair}"/>`;
    case 'ponytail':
      return `<path d="M20 26 Q20 12 32 12 Q44 12 44 26 L42 22 Q40 16 32 16 Q24 16 22 22 Z" fill="${hair}"/>`
        + `<circle cx="44" cy="18" r="4" fill="${hair}"/><path d="M44 20 Q50 28 47 38 L43 38 Q45 29 42 21 Z" fill="${hair}"/>`;
    case 'buzz':
      return `<path d="M22 22 Q24 13 32 13 Q40 13 42 22 Q40 16 32 16 Q24 16 22 22 Z" fill="${hair}"/>`;
    case 'curly':
      return `<g fill="${hair}"><circle cx="22" cy="20" r="5"/><circle cx="28" cy="14" r="5"/><circle cx="36" cy="14" r="5"/><circle cx="42" cy="20" r="5"/><rect x="21" y="16" width="22" height="8" rx="4"/></g>`;
    case 'hood':
      return `<path d="M17 32 Q17 8 32 8 Q47 8 47 32 L43 32 Q43 13 32 13 Q21 13 21 32 Z" fill="${hair}"/>`;
    case 'cap':
      return `<path d="M20 22 Q20 10 32 10 Q44 10 44 22 L44 20 L20 20 Z" fill="${hair}"/>`
        + `<rect x="18" y="19" width="28" height="4" rx="2" fill="${hair}"/>`
        + `<rect x="36" y="20" width="11" height="3" rx="1.5" fill="${hair}"/>`;
  }
}

function accessorySvg(acc: Accessory, color: string): string {
  switch (acc) {
    case 'glasses':
      return `<g><rect x="23" y="24" width="8" height="6" rx="2" fill="#1c1c22" opacity="0.9"/>`
        + `<rect x="33" y="24" width="8" height="6" rx="2" fill="#1c1c22" opacity="0.9"/>`
        + `<line x1="31" y1="26" x2="33" y2="26" stroke="#1c1c22" stroke-width="1.5"/>`
        + `<circle cx="25.5" cy="26" r="1" fill="#fff" opacity="0.8"/><circle cx="35.5" cy="26" r="1" fill="#fff" opacity="0.8"/></g>`;
    case 'headband':
      return `<rect x="20" y="20" width="24" height="4.5" rx="2" fill="${color}"/>`
        + `<rect x="41" y="21" width="5" height="2.5" rx="1" fill="${color}"/>`;
    case 'earring':
      return `<circle cx="20.5" cy="30" r="1.6" fill="#ffd75e" stroke="#b8860b" stroke-width="0.6"/>`;
    case 'scarf':
      return `<rect x="23" y="35" width="18" height="6" rx="3" fill="${color}"/>`
        + `<rect x="36" y="38" width="5" height="9" rx="2" fill="${color}"/>`;
    case 'goggles':
      return `<g><circle cx="27" cy="18.5" r="4.5" fill="#223" stroke="${color}" stroke-width="1.5"/>`
        + `<circle cx="37" cy="18.5" r="4.5" fill="#223" stroke="${color}" stroke-width="1.5"/>`
        + `<rect x="31" y="17.5" width="2" height="2" fill="${color}"/>`
        + `<circle cx="27" cy="18.5" r="1.5" fill="#9fd8ff" opacity="0.9"/><circle cx="37" cy="18.5" r="1.5" fill="#9fd8ff" opacity="0.9"/></g>`;
    default:
      return '';
  }
}

function companionSvg(kind: Companion): string {
  switch (kind) {
    case 'pika':
      // Пикачу-подобный: жёлтый колобок с ушами и щеками (правый нижний угол)
      return `<g>`
        + `<ellipse cx="49" cy="50" rx="7" ry="6" fill="#ffd93b" stroke="#c79a00" stroke-width="1"/>`
        + `<polygon points="44,45 42,37 46,41" fill="#ffd93b" stroke="#c79a00" stroke-width="0.8"/>`
        + `<polygon points="54,45 56,37 52,41" fill="#ffd93b" stroke="#c79a00" stroke-width="0.8"/>`
        + `<polygon points="44,44 42.5,38.5 45,41.5" fill="#2b2b2b"/>`
        + `<polygon points="54,44 55.5,38.5 53,41.5" fill="#2b2b2b"/>`
        + `<circle cx="46.5" cy="50" r="1.1" fill="#2b2b2b"/><circle cx="51.5" cy="50" r="1.1" fill="#2b2b2b"/>`
        + `<circle cx="44.5" cy="52.5" r="1.4" fill="#ff5a5a"/><circle cx="53.5" cy="52.5" r="1.4" fill="#ff5a5a"/>`
        + `</g>`;
    case 'bulb':
      // Луковичный: бирюзовый колобок с луковицей
      return `<g>`
        + `<ellipse cx="49" cy="51" rx="7" ry="5.5" fill="#7ed6a7" stroke="#2f8f5b" stroke-width="1"/>`
        + `<ellipse cx="49" cy="44.5" rx="3.5" ry="3" fill="#3fae6a" stroke="#2f8f5b" stroke-width="0.8"/>`
        + `<circle cx="46.8" cy="50.5" r="1.1" fill="#20301f"/><circle cx="51.2" cy="50.5" r="1.1" fill="#20301f"/>`
        + `<path d="M47.5 53.5 Q49 54.5 50.5 53.5" stroke="#20301f" stroke-width="0.8" fill="none"/>`
        + `</g>`;
    case 'bird':
      // Птичка: синий колобок с клювом и крылом
      return `<g>`
        + `<ellipse cx="49" cy="50" rx="6.5" ry="5.5" fill="#7ec3f5" stroke="#2b6cb0" stroke-width="1"/>`
        + `<polygon points="54.5,49 58,50.5 54.5,52" fill="#f5a623" stroke="#a35c00" stroke-width="0.6"/>`
        + `<circle cx="48" cy="49" r="1.1" fill="#1c2733"/>`
        + `<path d="M44 51 Q46 47 48 51 Q47 54 44 53 Z" fill="#4a90d9"/>`
        + `<polygon points="46,45 45,40 48,43" fill="#2b6cb0"/>`
        + `</g>`;
    case 'egg':
      // Яйцо с пятнами
      return `<g>`
        + `<ellipse cx="49" cy="51" rx="5.5" ry="7" fill="#fff7ee" stroke="#c9a87c" stroke-width="1"/>`
        + `<circle cx="47" cy="49" r="1.3" fill="#ffb3c1"/><circle cx="51" cy="52.5" r="1" fill="#a8d8ff"/><circle cx="49" cy="47.5" r="0.8" fill="#ffe28a"/>`
        + `</g>`;
    case 'ghost':
      // Призрачный blob
      return `<g>`
        + `<path d="M43 52 Q43 43 49 43 Q55 43 55 52 L54 55 L52 53 L50 55 L48 53 L46 55 L44 53 Z" fill="#9b7ede" stroke="#5b3fae" stroke-width="1"/>`
        + `<circle cx="47" cy="49" r="1.2" fill="#fff"/><circle cx="51" cy="49" r="1.2" fill="#fff"/>`
        + `<circle cx="47" cy="49" r="0.6" fill="#2b2450"/><circle cx="51" cy="49" r="0.6" fill="#2b2450"/>`
        + `</g>`;
    default:
      return '';
  }
}

function battleFxSvg(): string {
  return `<g opacity="0.35" stroke="#ffffff" stroke-width="2" stroke-linecap="round">`
    + `<line x1="7" y1="12" x2="17" y2="19"/><line x1="5" y1="22" x2="13" y2="27"/><line x1="48" y1="8" x2="56" y2="14"/>`
    + `</g>`
    + `<polygon points="32,3 35,11 43,7 39,14 48,16 39,19 42,28 34,22 28,29 29,20 20,19 28,16 26,7 31,12" fill="#ffffff" opacity="0.20"/>`;
}

function armsSvg(pose: Pose, jacketDark: string, skin: string): string {
  if (pose === 'action') {
    // Правая рука поднята вверх с покеболом
    return `<rect x="12" y="46" width="7" height="12" rx="3.5" fill="${jacketDark}"/>`
      + `<rect x="42" y="34" width="7" height="13" rx="3.5" fill="${jacketDark}" transform="rotate(24 45 40)"/>`
      + `<circle cx="51" cy="33" r="4.5" fill="#ee3e36"/><path d="M46.5 33 A4.5 4.5 0 0 0 55.5 33 Z" fill="#ee3e36"/>`
      + `<path d="M46.5 33 A4.5 4.5 0 0 1 55.5 33 L55.5 34.5 L46.5 34.5 Z" fill="#f5f5f5"/>`
      + `<rect x="46.5" y="32" width="9" height="1.6" fill="#2b2b2b"/><circle cx="51" cy="33.4" r="1.5" fill="#fff" stroke="#2b2b2b" stroke-width="0.8"/>`
      + `<circle cx="51" cy="33.4" r="0.6" fill="#2b2b2b"/>`;
  }
  if (pose === 'side') {
    // Корпус чуть боком: одно плечо выше
    return `<rect x="13" y="47" width="7" height="11" rx="3.5" fill="${jacketDark}"/>`
      + `<rect x="44" y="45" width="7" height="12" rx="3.5" fill="${jacketDark}"/>`
      + `<circle cx="16.5" cy="47" r="2.8" fill="${skin}"/>`;
  }
  return `<rect x="13" y="46" width="7" height="12" rx="3.5" fill="${jacketDark}"/>`
    + `<rect x="44" y="46" width="7" height="12" rx="3.5" fill="${jacketDark}"/>`;
}

function mouthSvg(kind: 'smile' | 'flat' | 'grin', x = 32, y = 32): string {
  if (kind === 'grin') return `<path d="M${x - 3} ${y} Q${x} ${y + 3} ${x + 3} ${y} L${x + 2} ${y - 0.5} Q${x} ${y + 1.5} ${x - 2} ${y - 0.5} Z" fill="#fff" stroke="#7a3b2e" stroke-width="0.7"/>`;
  if (kind === 'flat') return `<line x1="${x - 2.5}" y1="${y}" x2="${x + 2.5}" y2="${y}" stroke="#7a3b2e" stroke-width="1.2" stroke-linecap="round"/>`;
  return `<path d="M${x - 2.5} ${y - 0.5} Q${x} ${y + 2} ${x + 2.5} ${y - 0.5}" stroke="#7a3b2e" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
}

function buildAvatarSvg(cfg: AvatarCfg): string {
  const gid = `ag-${cfg.id}`;
  const hair = hairSvg(cfg.hairStyle, cfg.hair);
  const acc = accessorySvg(cfg.acc, cfg.accColor);
  const comp = companionSvg(cfg.companion);
  const fx = cfg.battle ? battleFxSvg() : '';
  const arms = armsSvg(cfg.pose, cfg.jacketDark, cfg.skin);
  const mouth = mouthSvg(cfg.mouth);
  const hoodBehind = cfg.hairStyle === 'hood' ? '' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${cfg.id}">`
    + `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${cfg.bg[0]}"/><stop offset="1" stop-color="${cfg.bg[1]}"/>`
    + `</linearGradient></defs>`
    + `<circle cx="32" cy="32" r="30" fill="url(#${gid})"/>`
    + `<circle cx="32" cy="32" r="30" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"/>`
    + fx
    + hoodBehind
    // тело
    + `<path d="M14 60 Q15 44 32 43 Q49 44 50 60 Z" fill="${cfg.jacket}"/>`
    + arms
    + `<path d="M26 44 L32 51 L38 44 L36.5 42 L27.5 42 Z" fill="${cfg.shirt}"/>`
    + `<circle cx="32" cy="53" r="4" fill="${cfg.emblem}" stroke="#ffffff" stroke-width="1"/>`
    + `<circle cx="32" cy="53" r="1.4" fill="#ffffff" opacity="0.9"/>`
    // шея + голова
    + `<rect x="28" y="34" width="8" height="7" rx="2.5" fill="${cfg.skin}"/>`
    + `<ellipse cx="32" cy="26" rx="11" ry="12" fill="${cfg.skin}"/>`
    + `<circle cx="21.5" cy="27" r="1.8" fill="${cfg.skin}"/><circle cx="42.5" cy="27" r="1.8" fill="${cfg.skin}"/>`
    + hair
    // лицо
    + `<circle cx="27.5" cy="27" r="1.7" fill="#26303b"/><circle cx="36.5" cy="27" r="1.7" fill="#26303b"/>`
    + `<circle cx="28" cy="26.4" r="0.55" fill="#ffffff"/><circle cx="37" cy="26.4" r="0.55" fill="#ffffff"/>`
    + `<path d="M24.5 23.5 Q27.5 22.5 30.5 23.5" stroke="#3a2a1c" stroke-width="1" fill="none" stroke-linecap="round"/>`
    + `<path d="M33.5 23.5 Q36.5 22.5 39.5 23.5" stroke="#3a2a1c" stroke-width="1" fill="none" stroke-linecap="round"/>`
    + `<circle cx="24.5" cy="30.5" r="1.2" fill="#ff9aa2" opacity="0.55"/><circle cx="39.5" cy="30.5" r="1.2" fill="#ff9aa2" opacity="0.55"/>`
    + mouth
    + acc
    + comp
    + `</svg>`;
}

// ── 26 аватарок: характеры / типы / позы / с покемоном и без / бой ──

const CFGS: AvatarCfg[] = [
  { id: 'rookie-boy', bg: ['#5aa9ff', '#1e3c72'], skin: '#ffd9b3', hair: '#4a3222', hairStyle: 'short', jacket: '#e23b3b', jacketDark: '#a82424', shirt: '#ffffff', acc: 'none', accColor: '#e23b3b', companion: 'none', battle: false, pose: 'front', emblem: '#e23b3b', mouth: 'smile' },
  { id: 'rookie-girl', bg: ['#ff9ec6', '#8e44ad'], skin: '#ffdbac', hair: '#b5521a', hairStyle: 'long', jacket: '#ff5e8a', jacketDark: '#c73a5e', shirt: '#fff0f4', acc: 'earring', accColor: '#ff5e8a', companion: 'none', battle: false, pose: 'front', emblem: '#ff5e8a', mouth: 'smile' },
  { id: 'fire-ace', bg: ['#ff7a3d', '#7a1e00'], skin: '#f1c27d', hair: '#e23b1f', hairStyle: 'spiky', jacket: '#2b2b30', jacketDark: '#17171a', shirt: '#ff7a3d', acc: 'headband', accColor: '#ff3b30', companion: 'none', battle: true, pose: 'action', emblem: '#ff7a1a', mouth: 'grin' },
  { id: 'aqua-sailor', bg: ['#5ec8ff', '#0b4f7a'], skin: '#ffd9b3', hair: '#1f6fb5', hairStyle: 'ponytail', jacket: '#ffffff', jacketDark: '#bcd6ea', shirt: '#1f6fb5', acc: 'none', accColor: '#1f6fb5', companion: 'bird', battle: false, pose: 'side', emblem: '#2f9df0', mouth: 'smile' },
  { id: 'volt-racer', bg: ['#ffe45e', '#8a6d00'], skin: '#e0ac69', hair: '#2b2b2b', hairStyle: 'buzz', jacket: '#f5d020', jacketDark: '#9a8200', shirt: '#2b2b2b', acc: 'goggles', accColor: '#2b2b2b', companion: 'none', battle: true, pose: 'action', emblem: '#f5d020', mouth: 'grin' },
  { id: 'leaf-ranger', bg: ['#7ede6a', '#14522b'], skin: '#c68642', hair: '#2f6b2f', hairStyle: 'curly', jacket: '#3fae6a', jacketDark: '#256b3f', shirt: '#e8f7d0', acc: 'none', accColor: '#3fae6a', companion: 'bulb', battle: false, pose: 'front', emblem: '#3fae3f', mouth: 'smile' },
  { id: 'rock-climber', bg: ['#c9a87c', '#4a3b28'], skin: '#e0ac69', hair: '#4a3222', hairStyle: 'buzz', jacket: '#8d7b68', jacketDark: '#5c5045', shirt: '#e8dcc8', acc: 'glasses', accColor: '#4a3b28', companion: 'none', battle: false, pose: 'side', emblem: '#8d6e4a', mouth: 'flat' },
  { id: 'ice-queen', bg: ['#bfe9ff', '#4a7fa5'], skin: '#ffe3d0', hair: '#bfe9ff', hairStyle: 'long', jacket: '#e8f4ff', jacketDark: '#9fc3dd', shirt: '#5ab0e6', acc: 'earring', accColor: '#5ab0e6', companion: 'none', battle: false, pose: 'front', emblem: '#5ab0e6', mouth: 'smile' },
  { id: 'psychic-sage', bg: ['#c99cff', '#4a2b8a'], skin: '#ffdbac', hair: '#5b3fae', hairStyle: 'short', jacket: '#6c4fd8', jacketDark: '#46319a', shirt: '#efe8ff', acc: 'glasses', accColor: '#46319a', companion: 'none', battle: false, pose: 'front', emblem: '#9b7ede', mouth: 'flat' },
  { id: 'dark-ninja', bg: ['#3a3a4a', '#0c0c14'], skin: '#e0ac69', hair: '#23232e', hairStyle: 'hood', jacket: '#2b2b38', jacketDark: '#14141c', shirt: '#0c0c14', acc: 'headband', accColor: '#5b3fae', companion: 'ghost', battle: true, pose: 'side', emblem: '#3a3a5a', mouth: 'flat' },
  { id: 'dragon-tamer', bg: ['#ff6b6b', '#3d0b4f'], skin: '#f1c27d', hair: '#0f7a6d', hairStyle: 'spiky', jacket: '#a8232a', jacketDark: '#6e1419', shirt: '#ffd75e', acc: 'scarf', accColor: '#a8232a', companion: 'bird', battle: false, pose: 'action', emblem: '#c0392b', mouth: 'grin' },
  { id: 'bug-catcher', bg: ['#d8f76a', '#3f6b1f'], skin: '#ffd9b3', hair: '#7a5a2b', hairStyle: 'cap', jacket: '#8fbf4a', jacketDark: '#5f7f2f', shirt: '#fff8d0', acc: 'glasses', accColor: '#5f7f2f', companion: 'bulb', battle: false, pose: 'front', emblem: '#7ac74c', mouth: 'smile' },
  { id: 'ghost-medium', bg: ['#6a5a9e', '#171228'], skin: '#ffe3d0', hair: '#241f38', hairStyle: 'long', jacket: '#3d3560', jacketDark: '#241f38', shirt: '#9b7ede', acc: 'earring', accColor: '#9b7ede', companion: 'ghost', battle: false, pose: 'side', emblem: '#6a5a9e', mouth: 'flat' },
  { id: 'steel-engineer', bg: ['#b8c4d0', '#3d4a57'], skin: '#e0ac69', hair: '#5a6570', hairStyle: 'short', jacket: '#7a8a99', jacketDark: '#4d5863', shirt: '#f5a623', acc: 'goggles', accColor: '#4d5863', companion: 'none', battle: false, pose: 'front', emblem: '#8a99a8', mouth: 'flat' },
  { id: 'fairy-star', bg: ['#ffc2dd', '#8a4a7a'], skin: '#ffdbac', hair: '#ff6b9d', hairStyle: 'curly', jacket: '#ff9ec6', jacketDark: '#c75a86', shirt: '#ffffff', acc: 'headband', accColor: '#ff6b9d', companion: 'egg', battle: false, pose: 'front', emblem: '#ff8ab5', mouth: 'smile' },
  { id: 'fighting-monk', bg: ['#ffb35c', '#7a3d00'], skin: '#c68642', hair: '#1c1c22', hairStyle: 'buzz', jacket: '#e67e22', jacketDark: '#9c4f0e', shirt: '#fff0d8', acc: 'headband', accColor: '#e67e22', companion: 'none', battle: true, pose: 'action', emblem: '#d35400', mouth: 'grin' },
  { id: 'ground-digger', bg: ['#e8c07a', '#6b4a1f'], skin: '#8d5524', hair: '#5a3a1c', hairStyle: 'cap', jacket: '#a87c3f', jacketDark: '#6e5025', shirt: '#f5e6c4', acc: 'scarf', accColor: '#6e5025', companion: 'none', battle: false, pose: 'side', emblem: '#a87c3f', mouth: 'flat' },
  { id: 'sky-pilot', bg: ['#8ad4ff', '#1c3f6e'], skin: '#ffd9b3', hair: '#d8b24a', hairStyle: 'short', jacket: '#2b5a8a', jacketDark: '#173350', shirt: '#e8f4ff', acc: 'glasses', accColor: '#173350', companion: 'bird', battle: true, pose: 'action', emblem: '#2f9df0', mouth: 'smile' },
  { id: 'poison-brewer', bg: ['#b07ee8', '#1f4a2b'], skin: '#e0ac69', hair: '#3f7a3f', hairStyle: 'long', jacket: '#5a3f8a', jacketDark: '#382657', shirt: '#b8e86a', acc: 'earring', accColor: '#5a3f8a', companion: 'bulb', battle: false, pose: 'side', emblem: '#7a4fb5', mouth: 'grin' },
  { id: 'lab-researcher', bg: ['#e8f0f5', '#5a7a8a'], skin: '#ffdbac', hair: '#3a3a3a', hairStyle: 'short', jacket: '#ffffff', jacketDark: '#c4d0d8', shirt: '#5ab0e6', acc: 'glasses', accColor: '#3a3a3a', companion: 'none', battle: false, pose: 'front', emblem: '#5ab0e6', mouth: 'smile' },
  { id: 'breeder-joy', bg: ['#ffd0a8', '#a54a5a'], skin: '#ffd9b3', hair: '#e86a8a', hairStyle: 'ponytail', jacket: '#ff8ab5', jacketDark: '#c75a86', shirt: '#ffffff', acc: 'none', accColor: '#ff8ab5', companion: 'egg', battle: false, pose: 'front', emblem: '#ff8ab5', mouth: 'smile' },
  { id: 'champ-veteran', bg: ['#ffd75e', '#5a3d00'], skin: '#c68642', hair: '#d8d8d8', hairStyle: 'spiky', jacket: '#2b2b30', jacketDark: '#101012', shirt: '#ffd75e', acc: 'scarf', accColor: '#ffd75e', companion: 'none', battle: true, pose: 'side', emblem: '#ffd75e', mouth: 'grin' },
  { id: 'battle-blaze', bg: ['#ff4a3d', '#4a0e00'], skin: '#f1c27d', hair: '#ff7a1a', hairStyle: 'spiky', jacket: '#38383f', jacketDark: '#1c1c20', shirt: '#ff4a3d', acc: 'headband', accColor: '#ffd75e', companion: 'none', battle: true, pose: 'action', emblem: '#ff4a3d', mouth: 'grin' },
  { id: 'duo-pika', bg: ['#7ec3f5', '#2b6cb0'], skin: '#ffd9b3', hair: '#4a3222', hairStyle: 'cap', jacket: '#2f6fb5', jacketDark: '#1c4470', shirt: '#ffd93b', acc: 'none', accColor: '#2f6fb5', companion: 'pika', battle: false, pose: 'front', emblem: '#2f9df0', mouth: 'smile' },
  { id: 'duo-ghost', bg: ['#4a3d6e', '#0e0a1c'], skin: '#ffe3d0', hair: '#6a5a9e', hairStyle: 'long', jacket: '#3a3050', jacketDark: '#211b30', shirt: '#241f38', acc: 'earring', accColor: '#9b7ede', companion: 'ghost', battle: false, pose: 'side', emblem: '#6a5a9e', mouth: 'smile' },
  { id: 'arena-hero', bg: ['#ff9a3d', '#7a1e3d'], skin: '#e0ac69', hair: '#2b2b2b', hairStyle: 'short', jacket: '#c0392b', jacketDark: '#7a1e14', shirt: '#ffd75e', acc: 'headband', accColor: '#ffd75e', companion: 'pika', battle: true, pose: 'action', emblem: '#ffd75e', mouth: 'grin' },
];

const NAMES: Record<string, string> = {
  'rookie-boy': 'Новичок Тим',
  'rookie-girl': 'Новичок Мия',
  'fire-ace': 'Огненный ас',
  'aqua-sailor': 'Морячка',
  'volt-racer': 'Вольт-гонщик',
  'leaf-ranger': 'Лесной рейнджер',
  'rock-climber': 'Скальный альпинист',
  'ice-queen': 'Ледяная королева',
  'psychic-sage': 'Пси-мудрец',
  'dark-ninja': 'Тёмный ниндзя',
  'dragon-tamer': 'Укротитель драконов',
  'bug-catcher': 'Ловец жуков',
  'ghost-medium': 'Медиум',
  'steel-engineer': 'Стальной инженер',
  'fairy-star': 'Фея-звезда',
  'fighting-monk': 'Боевой монах',
  'ground-digger': 'Копатель',
  'sky-pilot': 'Небесный пилот',
  'poison-brewer': 'Ядовар',
  'lab-researcher': 'Учёный',
  'breeder-joy': 'Заводчица',
  'champ-veteran': 'Ветеран-чемпион',
  'battle-blaze': 'Боевой рывок',
  'duo-pika': 'Дуэт с Пикачу',
  'duo-ghost': 'Дуэт с призраком',
  'arena-hero': 'Герой арены',
};

/** Полный пак: id + имя + inline-SVG. SVG строятся кодом выше. */
export const AVATARS: AvatarDef[] = CFGS.map((c) => ({
  id: c.id,
  name: NAMES[c.id] || c.id,
  svg: buildAvatarSvg(c),
}));

/** Быстрый доступ по id. */
const BY_ID = new Map<string, AvatarDef>(AVATARS.map((a) => [a.id, a]));

export const AVATAR_IDS: string[] = AVATARS.map((a) => a.id);

export function getAvatarById(id: string): AvatarDef | undefined {
  return BY_ID.get(id);
}

export function getAvatarSvg(id: string): string | undefined {
  return BY_ID.get(id)?.svg;
}

export function isAvatarId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

/** Дефолтная аватарка (первый новичок). */
export const DEFAULT_AVATAR_ID = 'rookie-boy';
