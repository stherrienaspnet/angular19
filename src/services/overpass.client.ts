import { Injectable } from '@angular/core';
import { defer, Observable, tap } from 'rxjs';
import type { WeatherLocation } from './weather.service';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface OverpassElement {
  id: number;
  tags?: {
    name?: string;
    'name:es'?: string;
    'name:en'?: string;
    place?: string;
    capital?: string;
  };
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}

export interface OverpassResponse {
  elements: OverpassElement[];
}

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

/** Larger zoom levels show smaller kinds of places. */
export function placeRegexForZoom(zoom: number): string {
  if (zoom > 11) {
    return '^(city|town|village|hamlet|suburb|island|islet|islet)$';
  }
  return zoom > 8 ? '^(city|town)$' : '^(city)$';
}

export function buildOverpassUrl(bounds: MapBounds, zoom: number): string {
  const query = `[out:json];
        (
          node["place"~"${placeRegexForZoom(zoom)}"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        );
        out center;`;
  return `${OVERPASS_API_URL}?data=${encodeURIComponent(query)}`;
}

export function parseOverpassLocations(
  data: OverpassResponse,
  zoom: number,
): WeatherLocation[] {
  return data.elements
    .filter((element) => element?.tags?.place)
    .map(
      (element): WeatherLocation => ({
        id: element.id.toString(),
        name: element.tags?.name || 'Unknown',
        name_es: element.tags?.['name:es'],
        name_en: element.tags?.['name:en'],
        latitude: element.lat || (element.center ? element.center.lat : 0),
        longitude: element.lon || (element.center ? element.center.lon : 0),
        place: element.tags?.place || '',
        capital:
          element.tags?.capital === 'yes' ? 1 : Number(element.tags?.capital),
      }),
    )
    .filter(
      (location) =>
        location.latitude !== 0 &&
        location.longitude !== 0 &&
        location.name !== 'Unknown' &&
        location.capital <= (zoom || 9),
    )
    .sort((a, b) => a.capital - b.capital);
}

@Injectable({ providedIn: 'root' })
export class OverpassClient {
  fetchLocations(
    bounds: MapBounds,
    zoom: number,
  ): Observable<WeatherLocation[]> {
    return defer(async () => {
      const response = await fetch(buildOverpassUrl(bounds, zoom));
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = (await response.json()) as OverpassResponse;
      if (!Array.isArray(data?.elements)) {
        console.warn('Invalid response from Overpass API:', data);
        return [];
      }
      return parseOverpassLocations(data, zoom);
    }).pipe(
      tap({
        error: (error: unknown) =>
          console.error('Error fetching from Overpass API:', error),
      }),
    );
  }
}
