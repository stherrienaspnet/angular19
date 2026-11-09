import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { GlobalServiceService, MapService, WeatherData } from '../../services';
import { HomeComponent } from './home.component';

const weather: WeatherData = {
  location: { id: '1', name: 'Madrid', name_en: 'Madrid EN', latitude: 40, longitude: -3, capital: 1 },
  temperature: 22,
  description: 'Soleado',
  humidity: 50,
  windSpeed: 4,
  precipitation: 0,
  date: '2025-01-01',
  icon: 'sun',
};

interface HomeInternals {
  onScroll(target: { clientHeight: number; scrollTop: number }): void;
  handleScrollEvent(target: EventTarget | null): unknown;
}

describe('HomeComponent', () => {
  const mapService = {
    ensureLeafletLoaded: vi.fn(),
    initMap: vi.fn(),
    useDefaultLocation: vi.fn(),
    addWeatherMarkers: vi.fn(),
    updateMarkersOnMapChange: vi.fn(),
    reloadLeaflet: vi.fn(),
  };
  const language = signal<'es' | 'en'>('en');

  function create(platformId = 'browser', mapId = 'map') {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platformId },
        { provide: GlobalServiceService, useValue: { selectedLanguage: language } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    }).overrideComponent(HomeComponent, {
      set: {
        providers: [{ provide: MapService, useValue: mapService }],
        imports: [],
        template: `@if (globalService.selectedLanguage() === 'en') {
            <div #mapContainer id="${mapId}"></div>
          }
          <div #buttons id="buttons"></div>
          @if (showBottomSheet()) {
            <span id="location">{{ locationName() }}</span>
            <span id="details">{{ locationDetails()[0].value }}</span>
            <a id="location-link" [href]="mapUrl()">Map</a>
          }`,
      },
    });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  function markerClickHandler(): (data: WeatherData) => void {
    return mapService.addWeatherMarkers.mock.calls[0][0] as (data: WeatherData) => void;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mapService.ensureLeafletLoaded.mockResolvedValue({ Map: class {} });
    mapService.initMap.mockReturnValue({});
    mapService.reloadLeaflet.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    language.set('en');
  });

  it('initializes the map and displays the selected marker weather', async () => {
    const fixture = create();
    await vi.advanceTimersByTimeAsync(0);
    expect(mapService.ensureLeafletLoaded).toHaveBeenCalledOnce();
    expect(mapService.useDefaultLocation).toHaveBeenCalledOnce();
    expect(mapService.updateMarkersOnMapChange).toHaveBeenCalledOnce();

    markerClickHandler()(weather);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('#location')?.textContent).toBe('Madrid EN');
    expect(element.querySelector('#details')?.textContent).toBe('22°C');
    expect(element.querySelector('#location-link')?.getAttribute('href')).toContain('query=40,-3');
  });

  it('uses the default name when there is no translation', () => {
    language.set('es');
    const fixture = create();
    fixture.componentInstance['handleWeatherMarkerClick'](weather);
    expect(fixture.componentInstance['locationName']()).toBe('Madrid');
  });

  it('ignores a marker without weather', async () => {
    const fixture = create();
    await vi.advanceTimersByTimeAsync(0);
    markerClickHandler()(undefined as unknown as WeatherData);
    expect(fixture.componentInstance['showBottomSheet']()).toBe(false);
  });

  it('waits until the map container is rendered before initializing', async () => {
    language.set('es');
    const fixture = create();
    await vi.advanceTimersByTimeAsync(0);
    expect(mapService.ensureLeafletLoaded).not.toHaveBeenCalled();

    language.set('en');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    expect(mapService.ensureLeafletLoaded).toHaveBeenCalledOnce();
  });

  it('does not initialize the map on the server', async () => {
    create('server');
    await vi.advanceTimersByTimeAsync(5000);
    expect(mapService.ensureLeafletLoaded).not.toHaveBeenCalled();
  });

  it('retries a few times when the map container cannot be found', async () => {
    create('browser', 'other');
    await vi.advanceTimersByTimeAsync(5000);
    expect(console.error).toHaveBeenCalledWith(
      'Map container not found, delaying initialization',
    );
    expect(mapService.ensureLeafletLoaded).not.toHaveBeenCalled();
  });

  describe('when the map cannot be created', () => {
    it.each([
      ['Leaflet cannot be loaded', () => mapService.ensureLeafletLoaded.mockResolvedValue(null)],
      ['Leaflet has no map', () => mapService.ensureLeafletLoaded.mockResolvedValue({})],
      ['the map is not created', () => mapService.initMap.mockReturnValue(undefined)],
      ['Leaflet throws', () => mapService.ensureLeafletLoaded.mockRejectedValue(new Error('boom'))],
    ])('reloads Leaflet and gives up after three retries when %s', async (_, arrange) => {
      arrange();
      create();
      await vi.advanceTimersByTimeAsync(20000);
      expect(mapService.reloadLeaflet).toHaveBeenCalledTimes(3);
      expect(mapService.reloadLeaflet).toHaveBeenCalledWith('map');
      expect(mapService.ensureLeafletLoaded).toHaveBeenCalledTimes(4);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to initialize Leaflet after multiple attempts',
      );
    });

    it('recovers once Leaflet loads', async () => {
      mapService.ensureLeafletLoaded
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ Map: class {} });
      create();
      await vi.advanceTimersByTimeAsync(5000);
      expect(mapService.reloadLeaflet).toHaveBeenCalledOnce();
      expect(mapService.updateMarkersOnMapChange).toHaveBeenCalledOnce();
    });
  });

  describe('bottom sheet scrolling', () => {
    it('moves the buttons with the sheet', () => {
      const fixture = create();
      const component = fixture.componentInstance as unknown as HomeInternals;
      component.onScroll({ clientHeight: 500, scrollTop: 100 });
      const buttons = fixture.nativeElement.querySelector('#buttons') as HTMLElement;
      expect(buttons.style.transform).toBe('translate3d(0, -100px, 0)');

      component.onScroll({ clientHeight: 500, scrollTop: 1000 });
      expect(buttons.style.transform).toBe('translate3d(0, -388px, 0)');
    });

    it('does nothing on the server', () => {
      const fixture = create('server');
      const component = fixture.componentInstance as unknown as HomeInternals;
      component.onScroll({ clientHeight: 500, scrollTop: 100 });
      const buttons = fixture.nativeElement.querySelector('#buttons') as HTMLElement;
      expect(buttons.style.transform).toBe('');
    });

    it('exposes the event target', () => {
      const fixture = create();
      const component = fixture.componentInstance as unknown as HomeInternals;
      const target = document.createElement('div');
      expect(component.handleScrollEvent(target)).toBe(target);
    });
  });
});
