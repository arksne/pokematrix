import { describe, it, expect } from 'vitest';
import {
  TRANSPORT_ROUTES,
  TRANSPORT_TICKETS,
  TRANSPORT_HUBS,
  routesFrom,
  routeFrom,
} from '../../data/transport.js';
import { REGIONS } from '../../data/regions.js';
import { transportStatus } from '../location.js';
import { isServiceLoc } from '../map.js';

const allLocs = { ...(REGIONS as any).kanto.locations, ...(REGIONS as any).johto.locations };
const BOARD_POINTS = ['goldenrodStation', 'saffronStation', 'olivinePier', 'vermilionPier'];

describe('M-6: транспорт — посадка только на вокзале/причале', () => {
  it('маршрутов ровно 4: поезд и паром в обе стороны', () => {
    expect(TRANSPORT_ROUTES).toHaveLength(4);
    expect(TRANSPORT_ROUTES.filter((r) => r.vehicle === 'train')).toHaveLength(2);
    expect(TRANSPORT_ROUTES.filter((r) => r.vehicle === 'ferry')).toHaveLength(2);
  });

  it('каждый маршрут идёт МЕЖДУ регионами (Канто ↔ Джото)', () => {
    for (const r of TRANSPORT_ROUTES) {
      const from = allLocs[r.from];
      const to = allLocs[r.to];
      expect(from, `локация отправления ${r.from}`).toBeTruthy();
      expect(to, `локация прибытия ${r.to}`).toBeTruthy();
      expect(from.region, `${r.from} → ${r.to}: отправление`).not.toBe(to.region);
    }
  });

  it('каждый маршрут уезжает из вокзала/причала, а не из города', () => {
    for (const r of TRANSPORT_ROUTES) {
      expect(BOARD_POINTS, `посадка ${r.from}`).toContain(r.from);
      expect(isServiceLoc(r.from), `${r.from} — сервис, не узел карты`).toBe(true);
    }
  });

  it('вокзалы/причалы связаны со своим городом пешком', () => {
    for (const p of BOARD_POINTS) {
      const loc = allLocs[p];
      expect(loc.links, `${p} никуда не ведёт`).toHaveLength(1);
      const city = loc.links[0];
      expect(allLocs[city], `${p} → ${city} не существует`).toBeTruthy();
      // И обратная связь: из города вокзал достижим
      expect(allLocs[city].links, `${city} не ссылается на ${p}`).toContain(p);
    }
  });

  it('из города посадки нет: routesFrom пуст', () => {
    for (const city of ['goldenrodCity', 'olivineCity', 'saffronCity', 'vermilionCity']) {
      expect(routesFrom(city), `${city} не должен быть точкой посадки`).toEqual([]);
      expect(routeFrom(city)).toBeUndefined();
    }
  });

  it('старый список хабов-городов пуст (дубль убран)', () => {
    expect(Object.keys(TRANSPORT_HUBS)).toEqual([]);
  });

  it('маршруты симметричны: обратный ведёт обратно (с вокзала/причала города прибытия)', () => {
    for (const r of TRANSPORT_ROUTES) {
      // Прибытие — в сам город. Обратный рейс отправляется с его вокзала/
      // причала: одна точка посадки, в городе посадки нет.
      const homeCity = allLocs[r.from].links[0];
      const board = allLocs[r.to].links.find((id: string) => BOARD_POINTS.includes(id));
      expect(board, `у ${r.to} нет вокзала/причала`).toBeTruthy();
      const back = TRANSPORT_ROUTES.find((x) => x.from === board);
      expect(back, `нет обратного рейса из ${board}`).toBeTruthy();
      expect(back?.to).toBe(homeCity);
      expect(back?.vehicle).toBe(r.vehicle);
    }
  });

  it('у каждого маршрута свой билет и время рейса', () => {
    for (const r of TRANSPORT_ROUTES) {
      expect(r.rideLoc).toBe(r.vehicle === 'train' ? 'trainRide' : 'seaFerryRide');
      expect(allLocs[r.rideLoc], `локация рейса ${r.rideLoc}`).toBeTruthy();
      expect(TRANSPORT_TICKETS[r.vehicle].ms).toBeGreaterThan(0);
      expect(r.label).toContain('ч');
    }
    expect(TRANSPORT_TICKETS.train.ticket).toBe('trainTicket');
    expect(TRANSPORT_TICKETS.ferry.ticket).toBe('ferryTicket');
  });

  it('рейсовые локи без выходов: сбежать в пути нельзя', () => {
    expect(allLocs.trainRide.links).toEqual([]);
    expect(allLocs.seaFerryRide.links).toEqual([]);
  });

  it('в рейсе — сильные энкаунтеры', () => {
    for (const id of ['trainRide', 'seaFerryRide']) {
      expect(allLocs[id].encounters.length, id).toBeGreaterThan(0);
      expect(allLocs[id].wildMinLvl).toBeGreaterThanOrEqual(30);
    }
  });
});

describe('M-6: статус рейса', () => {
  const NOW = 1_000_000_000_000;

  it('нет рейса — none', () => {
    expect(transportStatus(null, NOW).phase).toBe('none');
    expect(transportStatus({ vehicle: 'train' }, NOW).phase).toBe('none');
    expect(transportStatus({ vehicle: 'ufo' }, NOW).phase).toBe('none');
  });

  it('в пути — aboard с обратным отсчётом', () => {
    const r = transportStatus({ vehicle: 'train', arriveAt: NOW + 60_000 }, NOW);
    expect(r.phase).toBe('aboard');
    expect(r.msLeft).toBe(60_000);
  });

  it('прибыл по времени — arrived, остаток 0', () => {
    const r = transportStatus({ vehicle: 'ferry', arriveAt: NOW - 1 }, NOW);
    expect(r.phase).toBe('arrived');
    expect(r.msLeft).toBe(0);
  });

  it('поезд 2ч, паром 3ч', () => {
    expect(TRANSPORT_TICKETS.train.ms).toBe(2 * 60 * 60 * 1000);
    expect(TRANSPORT_TICKETS.ferry.ms).toBe(3 * 60 * 60 * 1000);
  });
});