import { firstValueFrom } from 'rxjs';
import {
  buildOverpassUrl,
  OverpassClient,
  parseOverpassLocations,
  placeRegexForZoom,
} from './overpass.client';

const bounds = { north: 45, south: 35, east: 0, west: -10 };

describe('Overpass helpers', () => {
  it.each([
    [6, '^(city)$'],
    [9, '^(city|town)$'],
    [12, '^(city|town|village|hamlet|suburb|island|islet|islet)$'],
  ])('uses the place filter of zoom %s', (zoom, regex) => {
    expect(placeRegexForZoom(zoom)).toBe(regex);
  });

  it('builds a query for the bounds in south, west, north, east order', () => {
    const url = decodeURIComponent(buildOverpassUrl(bounds, 6));
    expect(url).toContain('(35,-10,45,0)');
    expect(url).toContain('["place"~"^(city)$"]');
  });

  it('keeps usable locations sorted by capital level', () => {
    const locations = parseOverpassLocations(
      {
        elements: [
          { id: 1, lat: 40, lon: -3, tags: { name: 'Town', place: 'city', capital: '4' } },
          { id: 2, center: { lat: 41, lon: -4 }, tags: { name: 'Capital', place: 'city', capital: 'yes', 'name:es': 'Capital ES', 'name:en': 'Capital EN' } },
          { id: 3, lat: 42, lon: -5, tags: { name: 'Too distant', place: 'city', capital: '9' } },
          { id: 4, lat: 43, lon: -6, tags: { name: 'Not a place' } },
          { id: 5, lat: 0, lon: 0, tags: { name: 'No position', place: 'city', capital: '2' } },
          { id: 6, lat: 44, lon: -7, tags: { place: 'city', capital: '2' } },
        ],
      },
      6,
    );
    expect(locations.map((location) => location.id)).toEqual(['2', '1']);
    expect(locations[0]).toMatchObject({
      name: 'Capital',
      name_es: 'Capital ES',
      name_en: 'Capital EN',
      latitude: 41,
      longitude: -4,
      capital: 1,
      place: 'city',
    });
  });

  it('allows a larger capital level when the zoom is unknown', () => {
    const [location] = parseOverpassLocations(
      { elements: [{ id: 1, lat: 1, lon: 1, tags: { name: 'A', place: 'city', capital: '9' } }] },
      0,
    );
    expect(location.id).toBe('1');
  });
});

describe('OverpassClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests and parses the locations', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ elements: [{ id: 1, lat: 40, lon: -3, tags: { name: 'A', place: 'city', capital: '2' } }] })),
    );
    const locations = await firstValueFrom(new OverpassClient().fetchLocations(bounds, 6));
    expect(locations).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not request anything until subscribed', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    new OverpassClient().fetchLocations(bounds, 6);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns no locations for an invalid response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await firstValueFrom(new OverpassClient().fetchLocations(bounds, 6))).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('reports unsuccessful responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(firstValueFrom(new OverpassClient().fetchLocations(bounds, 6))).rejects.toThrow('HTTP error! Status: 503');
    expect(error).toHaveBeenCalled();
  });
});
