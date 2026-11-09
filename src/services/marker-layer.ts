import type * as Leaflet from 'leaflet';
import type { LeafletNamespace } from './leaflet-loader';
import { escapeHtml, weatherIconHtml } from './weather-icon';
import type { WeatherData } from './weather.service';

/** Subset shared by `L.LayerGroup` and the marker cluster group. */
export interface MarkerContainer {
  addLayer(layer: Leaflet.Layer): unknown;
  removeLayer(layer: Leaflet.Layer): unknown;
  clearLayers(): unknown;
}

/** Keeps track of the weather markers shown on the map, one per location. */
export class MarkerLayer {
  private markers: Leaflet.Marker[] = [];
  private readonly locationIds = new Set<string>();
  private readonly markerLocations = new Map<Leaflet.Marker, string>();

  constructor(
    private readonly leaflet: LeafletNamespace,
    private readonly container: MarkerContainer,
  ) {}

  get count(): number {
    return this.markers.length;
  }

  has(locationId: string): boolean {
    return this.locationIds.has(locationId);
  }

  add(
    weather: WeatherData,
    onClick?: (weather: WeatherData) => void,
  ): Leaflet.Marker | null {
    const { id, name, latitude, longitude } = weather.location;
    if (this.has(id)) {
      return null;
    }
    try {
      const marker = new this.leaflet.Marker([latitude, longitude], {
        icon: this.leaflet.divIcon({
          html: weatherIconHtml(weather.icon),
          className: 'weather-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
      });
      marker.bindPopup(
        `<b>${escapeHtml(name)}</b><br>${weather.temperature}°C - ${escapeHtml(weather.description)}`,
      );
      if (onClick) {
        marker.on('click', () => onClick(weather));
      }
      this.container.addLayer(marker);
      this.markers.push(marker);
      this.locationIds.add(id);
      this.markerLocations.set(marker, id);
      return marker;
    } catch (error) {
      console.error('Error creating weather marker:', error);
      return null;
    }
  }

  clear(): void {
    for (const marker of this.markers) {
      this.removeFromMap(marker);
    }
    this.markers = [];
    this.container.clearLayers();
    this.locationIds.clear();
    this.markerLocations.clear();
  }

  /** Removes the markers outside of the bounds and returns how many were removed. */
  removeOutside(bounds: Leaflet.LatLngBounds): number {
    const outside = this.markers.filter(
      (marker) => !bounds.contains(marker.getLatLng()),
    );
    for (const marker of outside) {
      this.container.removeLayer(marker);
      this.removeFromMap(marker);
      this.markers.splice(this.markers.indexOf(marker), 1);
      const locationId = this.markerLocations.get(marker);
      if (locationId) {
        this.locationIds.delete(locationId);
      }
      this.markerLocations.delete(marker);
    }
    return outside.length;
  }

  private removeFromMap(marker: Leaflet.Marker): void {
    try {
      marker.remove();
    } catch (error) {
      console.warn('Error removing marker:', error);
    }
  }
}
