import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MapService } from './map.service';
import { WeatherService } from './weather.service';

describe('MapService on the server', () => {
  it('does not load Leaflet or initialize a map', async () => {
    TestBed.configureTestingModule({
      providers: [
        MapService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: WeatherService, useValue: {} },
      ],
    });
    const service = TestBed.inject(MapService);
    expect(await service.getLeaflet()).toBeNull();
    expect(await service.getLeaflet(true)).toBeNull();
    expect(await service.ensureLeafletLoaded()).toBeNull();
    expect(service.initMap()).toBeUndefined();
  });
});

describe('MapService location search', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        MapService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: WeatherService, useValue: {} },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('filters and sorts locations returned by Overpass', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        elements: [
          { id: 1, lat: 40, lon: -3, tags: { name: 'Town', place: 'city', capital: '4' } },
          { id: 2, lat: 41, lon: -4, tags: { name: 'Capital', place: 'city', capital: 'yes', 'name:en': 'Capital' } },
          { id: 3, lat: 42, lon: -5, tags: { name: 'Too distant', place: 'city', capital: '9' } },
          { id: 4, lat: 43, lon: -6, tags: { name: 'Not a place' } },
        ],
      }), { status: 200 }),
    );
    const service = TestBed.inject(MapService);
    const result = await firstValueFrom(service.getLocationsByMapBounds({
      north: 45, south: 35, east: 0, west: -10,
    }));
    expect(result.map((location) => location.name)).toEqual(['Capital', 'Town']);
    expect(result[0]).toMatchObject({ id: '2', capital: 1, name_en: 'Capital' });
    expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain('(35,-10,45,0)');
  });

  it('propagates unsuccessful Overpass requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = TestBed.inject(MapService);
    await expect(firstValueFrom(service.getLocationsByMapBounds({
      north: 45, south: 35, east: 0, west: -10,
    }))).rejects.toThrow('HTTP error! Status: 503');
    expect(log).toHaveBeenCalled();
  });
});
