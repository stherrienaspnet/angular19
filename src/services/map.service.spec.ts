import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import {
  createFakeLeaflet,
  FakeMap,
  FakeMarker,
} from '../testing/fake-leaflet';
import { LeafletLoader } from './leaflet-loader';
import { MapService } from './map.service';
import { OverpassClient } from './overpass.client';
import {
  WeatherData,
  WeatherLocation,
  WeatherService,
} from './weather.service';

const bounds = { north: 45, south: 35, east: 0, west: -10 };

function location(id: string, latitude = 40, longitude = -3): WeatherLocation {
  return { id, name: `Place ${id}`, latitude, longitude, capital: 1 };
}

function weatherFor(place: WeatherLocation): WeatherData {
  return {
    location: place,
    temperature: 20,
    description: 'Soleado',
    humidity: 40,
    windSpeed: 5,
    precipitation: 0,
    date: '2025-01-01',
    icon: 'sun',
  };
}

function setup(platformId = 'browser', withClusters = true) {
  const leaflet = createFakeLeaflet(withClusters);
  const loader = { load: vi.fn().mockResolvedValue(leaflet) };
  const overpass = { fetchLocations: vi.fn().mockReturnValue(of([])) };
  const weather = {
    getWeatherForLocation: vi.fn(
      (place: WeatherLocation): Observable<WeatherData | null> =>
        of(weatherFor(place)),
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      MapService,
      { provide: PLATFORM_ID, useValue: platformId },
      { provide: LeafletLoader, useValue: loader },
      { provide: OverpassClient, useValue: overpass },
      { provide: WeatherService, useValue: weather },
    ],
  });
  return { service: TestBed.inject(MapService), leaflet, loader, overpass, weather };
}

async function setupMap(withClusters = true) {
  document.body.innerHTML = '<div id="map"></div>';
  const context = setup('browser', withClusters);
  await context.service.getLeaflet();
  const map = context.service.initMap() as unknown as FakeMap;
  return { ...context, map };
}

describe('MapService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('on the server', () => {
    it('never loads Leaflet nor creates a map', async () => {
      const { service, loader, overpass } = setup('server');
      loader.load.mockResolvedValue(null);
      expect(await service.getLeaflet()).toBeNull();
      expect(await service.ensureLeafletLoaded()).toBeNull();
      expect(service.initMap()).toBeUndefined();
      await service.reloadLeaflet();
      expect(loader.load).toHaveBeenCalledTimes(1);
      expect(overpass.fetchLocations).not.toHaveBeenCalled();
    });
  });

  describe('Leaflet loading', () => {
    it('keeps the loaded Leaflet', async () => {
      const { service, leaflet } = setup();
      expect(await service.getLeaflet()).toBe(leaflet);
      expect(service.L).toBe(leaflet);
    });

    it('tries again from scratch when Leaflet is unusable', async () => {
      const { service, loader, leaflet } = setup();
      loader.load.mockResolvedValueOnce({}).mockResolvedValue(leaflet);
      expect(await service.ensureLeafletLoaded()).toBe(leaflet);
      expect(loader.load).toHaveBeenNthCalledWith(1, false);
      expect(loader.load).toHaveBeenNthCalledWith(2, true);
    });

    it('uses the loaded Leaflet without reloading it', async () => {
      const { service, loader } = setup();
      await service.ensureLeafletLoaded();
      expect(loader.load).toHaveBeenCalledOnce();
    });

    it('configures the default icon path', async () => {
      const { service, leaflet } = setup();
      service.setupLeafletIcons();
      expect(leaflet.Icon.Default.imagePath).toBeUndefined();
      await service.getLeaflet();
      service.setupLeafletIcons();
      expect(leaflet.Icon.Default.imagePath).toContain('leaflet@1.9.4');
    });
  });

  describe('initMap', () => {
    it('requires Leaflet', () => {
      const { service } = setup();
      expect(service.initMap()).toBeUndefined();
    });

    it('requires the map container', async () => {
      const { service } = setup();
      await service.getLeaflet();
      expect(service.initMap('missing')).toBeUndefined();
    });

    it('creates the map with tiles and a cluster group', async () => {
      const { map, leaflet } = await setupMap();
      expect(map.id).toBe('map');
      expect(map.setView).toHaveBeenCalledWith([40.416775, -3.70379], 6);
      expect(leaflet.tileLayerAddTo).toHaveBeenCalledWith(map);
      expect(leaflet.clusterGroups).toHaveLength(1);
      expect(leaflet.clusterGroups[0].addTo).toHaveBeenCalledWith(map);
    });

    it('falls back to a plain layer group without the cluster plugin', async () => {
      const { map, leaflet } = await setupMap(false);
      expect(map).toBeDefined();
      expect(leaflet.clusterGroups).toHaveLength(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it('replaces the previous map', async () => {
      const { service, map } = await setupMap();
      expect(service.initMap()).not.toBe(map);
      expect(map.remove).toHaveBeenCalled();
    });

    it('reports a map that cannot be created', async () => {
      const { service, leaflet } = setup();
      document.body.innerHTML = '<div id="map"></div>';
      await service.getLeaflet();
      vi.mocked(leaflet.tileLayer).mockImplementation(() => {
        throw new Error('boom');
      });
      expect(service.initMap()).toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });

    it('goes back to the default location', async () => {
      const { service, map } = await setupMap();
      map.setView.mockClear();
      service.useDefaultLocation();
      expect(map.setView).toHaveBeenCalledWith([40.416775, -3.70379], 6);
    });

    it('ignores the default location without a map', () => {
      expect(() => setup().service.useDefaultLocation()).not.toThrow();
    });
  });

  describe('markers', () => {
    // The first markers are fetched through the debounced move stream.
    async function addMarkers(
      service: MapService,
      onClick?: (weather: WeatherData) => void,
    ): Promise<void> {
      service.addWeatherMarkers(onClick);
      await vi.advanceTimersByTimeAsync(500);
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('does nothing without a map', () => {
      const { service, overpass } = setup();
      service.addWeatherMarkers();
      expect(overpass.fetchLocations).not.toHaveBeenCalled();
    });

    it('adds a marker for each location of the current view', async () => {
      const { service, overpass, weather, leaflet } = await setupMap();
      overpass.fetchLocations.mockReturnValue(of([location('1'), location('2')]));
      const onClick = vi.fn();
      await addMarkers(service, onClick);
      expect(overpass.fetchLocations).toHaveBeenCalledWith(
        expect.objectContaining(bounds),
        6,
      );
      expect(weather.getWeatherForLocation).toHaveBeenCalledTimes(2);
      const markers = leaflet.clusterGroups[0].layers as FakeMarker[];
      expect(markers).toHaveLength(2);
      markers[0].click();
      expect(onClick).toHaveBeenCalled();
    });

    it('only adds the first markers once', async () => {
      const { service, overpass } = await setupMap();
      service.addWeatherMarkers();
      service.addWeatherMarkers();
      await vi.advanceTimersByTimeAsync(500);
      expect(overpass.fetchLocations).toHaveBeenCalledOnce();
    });

    it('does not duplicate or add markers without weather', async () => {
      const { service, overpass, weather, leaflet } = await setupMap();
      weather.getWeatherForLocation.mockImplementation((place) =>
        place.id === '3' ? of(null) : of(weatherFor(place)),
      );
      overpass.fetchLocations.mockReturnValue(
        of([location('1'), location('1'), location('3')]),
      );
      await addMarkers(service);
      expect(leaflet.clusterGroups[0].layers).toHaveLength(1);
    });

    it('reports weather and location errors', async () => {
      const { service, overpass, weather } = await setupMap();
      weather.getWeatherForLocation.mockReturnValue(throwError(() => new Error('weather')));
      overpass.fetchLocations.mockReturnValue(of([location('1')]));
      await addMarkers(service);
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching weather for Place 1:',
        expect.any(Error),
      );

      TestBed.resetTestingModule();
      const second = await setupMap();
      second.overpass.fetchLocations.mockReturnValue(throwError(() => new Error('overpass')));
      await addMarkers(second.service);
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching locations:',
        expect.any(Error),
      );
    });

    it('cannot read the bounds of a map that is not ready', async () => {
      const { service, map, overpass } = await setupMap();
      map.bounds = undefined;
      await addMarkers(service);
      expect(overpass.fetchLocations).not.toHaveBeenCalled();

      TestBed.resetTestingModule();
      const second = await setupMap();
      second.map.getBounds = () => {
        throw new Error('boom');
      };
      await addMarkers(second.service);
      expect(console.error).toHaveBeenCalledWith(
        'Error getting map bounds:',
        expect.any(Error),
      );
    });

    it('skips redundant requests while the first markers are added', async () => {
      const { service, overpass } = await setupMap();
      service.addWeatherMarkers();
      overpass.fetchLocations.mockClear();
      expect(await firstValueFrom(service.getLocationsByMapBounds(bounds))).toEqual([]);
      expect(overpass.fetchLocations).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      overpass.fetchLocations.mockReturnValue(of([location('9')]));
      expect(await firstValueFrom(service.getLocationsByMapBounds(bounds))).toHaveLength(1);
    });

    it('clears every marker and allows adding them again', async () => {
      const { service, overpass, leaflet } = await setupMap();
      overpass.fetchLocations.mockReturnValue(of([location('1')]));
      await addMarkers(service);
      const [marker] = leaflet.clusterGroups[0].layers as FakeMarker[];
      service.clearMarkers();
      expect(marker.remove).toHaveBeenCalled();
      expect(leaflet.clusterGroups[0].layers).toHaveLength(0);
      await addMarkers(service);
      expect(leaflet.clusterGroups[0].layers).toHaveLength(1);
    });

    it('only clears the markers outside of the view', async () => {
      const { service, overpass, leaflet, map } = await setupMap();
      overpass.fetchLocations.mockReturnValue(
        of([location('1', 40, -3), location('2', 60, 20)]),
      );
      await addMarkers(service);
      expect(leaflet.clusterGroups[0].layers).toHaveLength(2);
      service.clearMarkers(false);
      expect(leaflet.clusterGroups[0].layers).toHaveLength(1);
      map.bounds = undefined;
      service.clearMarkers(false);
      expect(leaflet.clusterGroups[0].layers).toHaveLength(1);
    });
  });

  describe('map changes', () => {
    it('needs a map', () => {
      const { service } = setup();
      expect(() => service.updateMarkersOnMapChange()).not.toThrow();
    });

    it('refreshes all the markers once a zoom settles', async () => {
      vi.useFakeTimers();
      const { service, overpass, leaflet, map } = await setupMap();
      overpass.fetchLocations.mockReturnValue(of([location('1')]));
      service.addWeatherMarkers();
      overpass.fetchLocations.mockClear();
      overpass.fetchLocations.mockReturnValue(of([location('2')]));
      service.updateMarkersOnMapChange();

      map.zoomTo(9);
      expect(overpass.fetchLocations).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(500);

      expect(overpass.fetchLocations).toHaveBeenCalledOnce();
      expect(overpass.fetchLocations).toHaveBeenCalledWith(expect.objectContaining(bounds), 9);
      const markers = leaflet.clusterGroups[0].layers as FakeMarker[];
      expect(markers.map((marker) => marker.latlng)).toEqual([[40, -3]]);
      expect(markers).toHaveLength(1);
    });

    it('keeps the markers in view when the map is only panned', async () => {
      vi.useFakeTimers();
      const { service, overpass, leaflet, map } = await setupMap();
      overpass.fetchLocations.mockReturnValue(
        of([location('1', 40, -3), location('2', 60, 20)]),
      );
      service.addWeatherMarkers();
      await vi.advanceTimersByTimeAsync(500);
      expect(leaflet.clusterGroups[0].layers).toHaveLength(2);
      service.updateMarkersOnMapChange();
      overpass.fetchLocations.mockReturnValue(of([]));

      map.pan();
      await vi.advanceTimersByTimeAsync(500);

      expect(leaflet.clusterGroups[0].layers).toHaveLength(1);
      expect(overpass.fetchLocations).toHaveBeenLastCalledWith(expect.anything(), 6);
    });

    it('ignores moves when the bounds are unavailable', async () => {
      vi.useFakeTimers();
      const { service, overpass, map } = await setupMap();
      service.updateMarkersOnMapChange();
      overpass.fetchLocations.mockClear();
      map.bounds = undefined;
      map.pan();
      await vi.advanceTimersByTimeAsync(500);
      expect(overpass.fetchLocations).not.toHaveBeenCalled();
    });

    it('keeps listening after a failed request', async () => {
      vi.useFakeTimers();
      const { service, overpass, leaflet, map } = await setupMap();
      service.addWeatherMarkers();
      service.updateMarkersOnMapChange();

      overpass.fetchLocations.mockReturnValue(throwError(() => new Error('502')));
      map.zoomTo(8);
      await vi.advanceTimersByTimeAsync(500);
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching locations:',
        expect.any(Error),
      );

      overpass.fetchLocations.mockReturnValue(of([location('7')]));
      map.zoomTo(9);
      await vi.advanceTimersByTimeAsync(500);
      expect(leaflet.clusterGroups[0].layers).toHaveLength(1);
    });
  });

  describe('reloadLeaflet', () => {
    it('recreates the map', async () => {
      vi.useFakeTimers();
      const { service, map } = await setupMap();
      const reload = service.reloadLeaflet();
      await vi.advanceTimersByTimeAsync(500);
      await reload;
      expect(map.remove).toHaveBeenCalled();
      expect(FakeMap.instances).toHaveLength(2);
    });

    it('stops when Leaflet cannot be loaded', async () => {
      vi.useFakeTimers();
      const { service, loader } = await setupMap();
      loader.load.mockResolvedValue(null);
      const reload = service.reloadLeaflet();
      await vi.advanceTimersByTimeAsync(500);
      await reload;
      expect(console.error).toHaveBeenCalledWith(
        'Failed to reload Leaflet after multiple attempts',
      );
      expect(FakeMap.instances).toHaveLength(1);
    });

    it('reports an error while removing the map', async () => {
      vi.useFakeTimers();
      const { service, map } = await setupMap();
      map.remove.mockImplementation(() => {
        throw new Error('boom');
      });
      const reload = service.reloadLeaflet();
      await vi.advanceTimersByTimeAsync(500);
      await reload;
      expect(console.error).toHaveBeenCalledWith('Error removing map:', expect.any(Error));
    });
  });

  it('removes the map when destroyed', async () => {
    const { map } = await setupMap();
    TestBed.resetTestingModule();
    expect(map.remove).toHaveBeenCalled();
  });

  it('requests the locations with the current zoom and returns them', async () => {
    const { service, overpass } = setup();
    overpass.fetchLocations.mockReturnValue(of([location('1')]));
    const locations = await firstValueFrom(
      service.getLocationsByMapBounds({ ...bounds, isZoomChange: true }),
    );
    expect(locations).toHaveLength(1);
    expect(overpass.fetchLocations).toHaveBeenCalledWith(
      expect.objectContaining(bounds),
      6,
    );
  });
});
