import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSiteMoveDetail, clearSiteMoveCache } from '../sitemove.js';

const SITE_DETAIL = {
  name: 'thunder-shock',
  power: 40, accuracy: 100, pp: 30,
  type: { name: 'electric' },
  damage_class: { name: 'special' },
  priority: 0,
  target: { name: 'selected-pokemon' },
  stat_changes: [],
  meta: { ailment: { name: 'paralysis' }, ailment_chance: 10 },
};

describe('fetchSiteMoveDetail', () => {
  beforeEach(() => {
    clearSiteMoveCache();
    vi.unstubAllGlobals();
  });

  it('берёт детали с /api/sitemove по имени', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => SITE_DETAIL }));
    vi.stubGlobal('fetch', fetchMock);
    const d = await fetchSiteMoveDetail({ move: { name: 'thunder-shock', url: 'https://pokeapi.co/api/v2/move/84/' } });
    expect(d.power).toBe(40);
    expect(d.meta.ailment.name).toBe('paralysis');
    expect(fetchMock).toHaveBeenCalledWith('/api/sitemove/thunder-shock');
  });

  it('имя из URL (Title Case из сайта → slug)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => SITE_DETAIL }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchSiteMoveDetail({ move: { name: 'Thunder Shock', url: '' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/sitemove/thunder-shock');
  });

  it('кэш: второй вызов без fetch', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => SITE_DETAIL }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchSiteMoveDetail('thunder-shock');
    await fetchSiteMoveDetail('thunder-shock');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('404 сайта → fallback PokeAPI-прокси', async () => {
    const pokeDetail = { ...SITE_DETAIL, power: 40 };
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).startsWith('/api/sitemove')) return { ok: false, status: 404 };
      return { ok: true, json: async () => pokeDetail };
    });
    vi.stubGlobal('fetch', fetchMock);
    const d = await fetchSiteMoveDetail('thunder-shock');
    expect(d.power).toBe(40);
    expect(fetchMock).toHaveBeenCalledWith('/api/pokeapi/move/thunder-shock/');
  });

  it('пустое имя → throw', async () => {
    await expect(fetchSiteMoveDetail({ move: {} })).rejects.toThrow();
  });
});
