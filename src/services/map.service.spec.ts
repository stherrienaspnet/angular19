import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
