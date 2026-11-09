import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { WeatherLocation, WeatherService } from './weather.service';

const location: WeatherLocation = {
  id: '1',
  name: 'Test',
  latitude: 40,
  longitude: -3,
  capital: 0,
};

describe('WeatherService', () => {
  function setup(platformId: string) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    return {
      service: TestBed.inject(WeatherService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('does not request weather during server rendering', async () => {
    const { service, http } = setup('server');
    expect(await firstValueFrom(service.getWeatherForLocation(location))).toBeNull();
    http.expectNone(() => true);
  });

  it('maps weather and forecasts, updates the signal and caches the result', async () => {
    const { service, http } = setup('browser');
    const result = firstValueFrom(service.getWeatherForLocation(location));
    const request = http.expectOne((req) => req.url.startsWith('https://api.open-meteo.com/v1/forecast'));
    expect(request.request.urlWithParams).toContain('latitude=40');
    request.flush({
      current_weather: { temperature: 20, windspeed: 5, weathercode: 0, time: '2025-01-01T12:00' },
      hourly: { time: [], relativehumidity_2m: [], precipitation: [] },
      daily: {
        time: ['2025-01-01', '2025-01-02'],
        weathercode: [0, 61],
        temperature_2m_max: [20, 18],
        temperature_2m_min: [10, 8],
      },
    });
    const weather = await result;
    expect(weather).toMatchObject({
      location,
      temperature: 20,
      description: 'Soleado',
      icon: 'sun',
      humidity: 0,
      precipitation: 0,
      forecast: [{ date: '2025-01-02', temperature: { min: 8, max: 18 }, icon: 'cloud-rain' }],
    });
    expect(service.currentWeather()).toEqual(weather);
    expect(await firstValueFrom(service.getWeatherForLocation(location))).toEqual(weather);
    http.expectNone(() => true);
  });

  it('logs failed requests and returns no weather', async () => {
    const { service, http } = setup('browser');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const result = firstValueFrom(service.getWeatherForLocation(location));
      http.expectOne((req) => req.url.startsWith('https://api.open-meteo.com/'))
        .flush('error', { status: 500, statusText: 'Server Error' });
      expect(await result).toBeNull();
      expect(service.currentWeather()).toBeNull();
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
