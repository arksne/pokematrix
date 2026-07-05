// ─────────────────────────────────────────────────────────────
// starters.ts — СТАРТОВЫЕ ПОКЕМОНЫ ПО ПОКОЛЕНИЯМ
// ─────────────────────────────────────────────────────────────
// GEN_STARTERS — массив массивов: каждое поколение = 3 покемона.
// Индекс = номер поколения (0 = Kanto, 1 = Johto, и т.д.)
//
// Используется:
//   starter.ts   → giveStarter() — выбор стартового при новой игре
//   auth.ts      → showRegistrationScreen() — выбор при регистрации
//   shop.ts      — продажа стартовых (если доступно)
// ─────────────────────────────────────────────────────────────
export const GEN_STARTERS = [
  ['bulbasaur', 'charmander', 'squirtle'],
  ['chikorita', 'cyndaquil', 'totodile'],
  ['treecko', 'torchic', 'mudkip'],
  ['turtwig', 'chimchar', 'piplup'],
  ['snivy', 'tepig', 'oshawott'],
  ['chespin', 'fennekin', 'froakie'],
  ['rowlet', 'litten', 'popplio'],
  ['grookey', 'scorbunny', 'sobble'],
  ['sprigatito', 'fuecoco', 'quaxly']
];