// ─────────────────────────────────────────────────────────────
// transport.ts — МЕЖРЕГИОНАЛЬНЫЙ ТРАНСПОРТ (интервью M, п.6/13)
// ─────────────────────────────────────────────────────────────
// Посадка — ТОЛЬКО на вокзале или причале, отдельной точкой у города.
// В самом городе кнопок рейса нет: одна точка посадки на рейс, как и решил
// хозяин. Раньше тут лежал второй, мгновенный список TRANSPORT_HUBS с
// кнопками прямо в городах (Голденрод → Сеймур, Оливин → Вермилион):
// игрок телепортировался между регионами без рейса, без билета и без
// сильных энкаунтеров в пути. Два конкурирующих способа уехать — это и
// было «старыми дублями», которые надо было убрать.
//
// Теперь единственный путь наехать — data/transport.ts + boardTransport
// в ui/location.ts: билет сгорает, рейс 2–3 часа, по дороге ловятся
// сильные покемоны (локи trainRide / seaFerryRide).
//
// Направления — между РЕГИОНАМИ (Канто ↔ Джото), как и просил хозяин:
//   Магнито-поезд:  Голденрод ↔ Саффрон
//   Паром:          Оливин ↔ Вермилион
// ─────────────────────────────────────────────────────────────

export type TransportVehicle = 'train' | 'ferry';

/** Билеты и их цена за поездку (покупаются в маркете, ID = src/data/items.ts). */
export const TRANSPORT_TICKETS: Record<TransportVehicle, { ticket: string; ms: number; label: string }> = {
  train: { ticket: 'trainTicket', ms: 2 * 60 * 60 * 1000, label: 'поезд' },
  ferry: { ticket: 'ferryTicket', ms: 3 * 60 * 60 * 1000, label: 'паром' },
};

export interface TransportRoute {
  /** Откуда садятся: вокзал или причал. */
  from: string;
  /** Куда прибывают: ID локации в другом регионе. */
  to: string;
  vehicle: TransportVehicle;
  /** Локация в пути (сильные энкаунтеры). */
  rideLoc: string;
  /** Подпись кнопки посадки. */
  label: string;
}

/**
 * Все маршруты, обе стороны. Ключ — вокзал/причал посадки.
 * Реверс объявлен явно (а не «автоматически»), чтобы проезд в одну сторону
 * нельзя было случайно получить в другую.
 */
export const TRANSPORT_ROUTES: TransportRoute[] = [
  {
    from: 'goldenrodStation', to: 'saffronCity', vehicle: 'train', rideLoc: 'trainRide',
    label: '🚂 Магнито-поезд в Саффрон-Сити (2 ч)',
  },
  {
    from: 'saffronStation', to: 'goldenrodCity', vehicle: 'train', rideLoc: 'trainRide',
    label: '🚂 Магнито-поезд в Голденрод-Сити (2 ч)',
  },
  {
    from: 'olivinePier', to: 'vermilionCity', vehicle: 'ferry', rideLoc: 'seaFerryRide',
    label: '⛴ Паром в Вермилион-Сити (3 ч)',
  },
  {
    from: 'vermilionPier', to: 'olivineCity', vehicle: 'ferry', rideLoc: 'seaFerryRide',
    label: '⛴ Паром в Оливин-Сити (3 ч)',
  },
];

/** Маршруты, отправляющиеся из локации (пусто = посадки здесь нет). */
export function routesFrom(locId: string): TransportRoute[] {
  return TRANSPORT_ROUTES.filter((r) => r.from === locId);
}

/** Маршрут по id отправления. */
export function routeFrom(locId: string): TransportRoute | undefined {
  return TRANSPORT_ROUTES.find((r) => r.from === locId);
}

/**
 * Старый список хабов-городов. Оставлен пустым объектом НАМЕРЕННО: на него
 * ссылаются тесты и UI-проверки, которые ищут «кнопки рейса в городе».
 * Ни одна локация-город не должна быть ключом здесь.
 */
export const TRANSPORT_HUBS: Record<string, never[]> = {};