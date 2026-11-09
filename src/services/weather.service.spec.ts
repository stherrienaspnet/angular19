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

  it.each([
    [0, 'Soleado', 'sun'],
    [1, 'Parcialmente nublado', 'cloud-sun'],
    [2, 'Parcialmente nublado', 'cloud-sun'],
    [3, 'Nublado', 'cloud'],
    [45, 'Niebla', 'foggy'],
    [48, 'Niebla', 'foggy'],
    [51, 'Llovizna', 'cloud-sun-rain'],
    [53, 'Llovizna', 'cloud-sun-rain'],
    [55, 'Llovizna', 'cloud-sun-rain'],
    [61, 'Lluvia ligera', 'cloud-rain'],
    [63, 'Lluvia ligera', 'cloud-rain'],
    [65, 'Lluvia intensa', 'cloud-showers-heavy'],
    [80, 'Lluvia intensa', 'cloud-showers-heavy'],
    [81, 'Lluvia intensa', 'cloud-showers-heavy'],
    [82, 'Lluvia intensa', 'cloud-showers-heavy'],
    [71, 'Nieve', 'snowflake'],
    [73, 'Nieve', 'snowflake'],
    [75, 'Nieve', 'snowflake'],
    [95, 'Tormenta', 'bolt'],
    [96, 'Tormenta', 'bolt'],
    [99, 'Tormenta', 'bolt'],
    [1234, 'Desconocido', 'question'],
  ])('describes the weather code %s as %s', async (code, description, icon) => {
    const { service, http } = setup('browser');
    const result = firstValueFrom(service.getWeatherForLocation(location));
    http.expectOne((req) => req.url.startsWith('https://api.open-meteo.com/')).flush({
      current_weather: { temperature: 1, windspeed: 1, weathercode: code, time: 't' },
      hourly: { time: [], relativehumidity_2m: [], precipitation: [] },
      daily: { time: [], weathercode: [], temperature_2m_max: [], temperature_2m_min: [] },
    });
    expect(await result).toMatchObject({ description, icon, forecast: [] });
  });

  it('reads the humidity and precipitation of the current hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2025, 0, 1, 12, 30));
      const { service, http } = setup('browser');
      const result = firstValueFrom(service.getWeatherForLocation(location));
      http.expectOne((req) => req.url.startsWith('https://api.open-meteo.com/')).flush({
        current_weather: { temperature: 1, windspeed: 3, weathercode: 0, time: 't' },
        hourly: {
          time: [new Date(2025, 0, 1, 11).toISOString(), new Date(2025, 0, 1, 12).toISOString()],
          relativehumidity_2m: [10, 65],
          precipitation: [0.1, 0.7],
        },
        daily: { time: [], weathercode: [], temperature_2m_max: [], temperature_2m_min: [] },
      });
      expect(await result).toMatchObject({ humidity: 65, precipitation: 0.7, windSpeed: 3 });
    } finally {
      vi.useRealTimers();
    }
  });
});
