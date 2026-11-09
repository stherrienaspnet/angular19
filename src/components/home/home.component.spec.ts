import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { GlobalServiceService, MapService, WeatherData } from '../../services';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  const mapService = {
    ensureLeafletLoaded: vi.fn(),
    initMap: vi.fn(),
    useDefaultLocation: vi.fn(),
    addWeatherMarkers: vi.fn(),
    updateMarkersOnMapChange: vi.fn(),
  };
  const language = signal<'es' | 'en'>('en');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mapService.ensureLeafletLoaded.mockResolvedValue({ Map: class {} });
    mapService.initMap.mockReturnValue({});
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: GlobalServiceService, useValue: { selectedLanguage: language } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    }).overrideComponent(HomeComponent, {
      set: {
        providers: [{ provide: MapService, useValue: mapService }],
        imports: [],
        template: `@if (globalService.selectedLanguage() === 'en') {
            <div #mapContainer id="map"></div>
          }
          @if (showBottomSheet()) {
            <span id="location">{{ locationName() }}</span>
            <span id="details">{{ locationDetails()[0].value }}</span>
            <a id="location-link" [href]="mapUrl()">Map</a>
          }`,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    language.set('en');
  });

  it('initializes the map and displays the selected marker weather', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    expect(mapService.ensureLeafletLoaded).toHaveBeenCalledOnce();
    expect(mapService.useDefaultLocation).toHaveBeenCalledOnce();
    expect(mapService.updateMarkersOnMapChange).toHaveBeenCalledOnce();

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
    const onMarkerClick = mapService.addWeatherMarkers.mock.calls[0][0] as (data: WeatherData) => void;
    onMarkerClick(weather);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('#location')?.textContent).toBe('Madrid EN');
    expect(element.querySelector('#details')?.textContent).toBe('22°C');
    expect(element.querySelector('#location-link')?.getAttribute('href')).toContain('query=40,-3');
  });

  it('waits until the map container is rendered before initializing', async () => {
    language.set('es');
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    expect(mapService.ensureLeafletLoaded).not.toHaveBeenCalled();

    language.set('en');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    expect(mapService.ensureLeafletLoaded).toHaveBeenCalledOnce();
  });
});
