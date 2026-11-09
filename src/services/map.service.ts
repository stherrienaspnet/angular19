import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type * as Leaflet from 'leaflet';
import {
  catchError,
  debounceTime,
  Observable,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { LeafletLoader, LeafletNamespace } from './leaflet-loader';
import { MarkerContainer, MarkerLayer } from './marker-layer';
import { MapBounds, OverpassClient } from './overpass.client';
import {
  WeatherData,
  WeatherLocation,
  WeatherService,
} from './weather.service';

type MapMove = MapBounds & { isZoomChange: boolean };
type MarkerClickCallback = (weatherData: WeatherData) => void;

const DEFAULT_CENTER: [number, number] = [40.416775, -3.70379];
const DEFAULT_ZOOM = 6;
const MOVE_DEBOUNCE_MS = 500;
const INIT_PHASE_MS = 1000;
const RELOAD_DELAY_MS = 500;
const LEAFLET_IMAGE_PATH = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';

@Injectable()
export class MapService {
  public L: LeafletNamespace | null = null;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly loader = inject(LeafletLoader);
  private readonly overpass = inject(OverpassClient);
  private readonly weatherService = inject(WeatherService);
  private readonly mapMoves = new Subject<MapMove>();

  private map?: Leaflet.Map;
  private markerLayer?: MarkerLayer;
  private markerClickCallback?: MarkerClickCallback;
  private currentZoomLevel = DEFAULT_ZOOM;

  // While initializing, the first markers are already being fetched, so
  // moves must not trigger redundant Overpass requests.
  private markersAddedDuringInit = false;
  private isInitializing = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.destroyMap());

    if (this.isBrowser) {
      this.mapMoves
        .pipe(
          debounceTime(MOVE_DEBOUNCE_MS),
          switchMap((bounds) => {
            this.clearMarkers(bounds.isZoomChange);
            return this.overpass
              .fetchLocations(bounds, this.currentZoomLevel)
              .pipe(
                catchError((error: unknown) => {
                  console.error('Error fetching locations:', error);
                  return of([] as WeatherLocation[]);
                }),
              );
          }),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe((locations) =>
          this.addMarkersForLocations(locations, this.markerClickCallback),
        );
    }
  }

  /** Loads Leaflet on first use. Resolves to null on the server. */
  public async getLeaflet(
    forceReload = false,
  ): Promise<LeafletNamespace | null> {
    this.L = await this.loader.load(forceReload);
    return this.L;
  }

  /** Loads Leaflet, trying once more from scratch if the first attempt failed. */
  public async ensureLeafletLoaded(): Promise<LeafletNamespace | null> {
    if (!this.isBrowser) {
      return null;
    }
    const leaflet = await this.getLeaflet();
    return leaflet?.Map ? leaflet : this.getLeaflet(true);
  }

  public setupLeafletIcons(): void {
    if (this.L?.Icon?.Default) {
      this.L.Icon.Default.imagePath = LEAFLET_IMAGE_PATH;
    }
  }

  public initMap(containerId = 'map'): Leaflet.Map | undefined {
    if (!this.isBrowser) {
      return undefined;
    }
    this.markersAddedDuringInit = false;
    this.isInitializing = true;

    const leaflet = this.L;
    if (!leaflet?.Map) {
      console.error('Leaflet not available in initMap');
      return undefined;
    }
    if (!document.getElementById(containerId)) {
      console.error('Map container not found');
      return undefined;
    }

    try {
      this.setupLeafletIcons();
      this.destroyMap();

      const map = new leaflet.Map(containerId, {
        zoomControl: true,
        attributionControl: true,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true,
      }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      leaflet
        .tileLayer(TILE_URL, {
          maxZoom: 19,
          attribution: 'by Gabri Mejía with ❤️',
        })
        .addTo(map);

      this.map = map;
      this.markerLayer = new MarkerLayer(
        leaflet,
        this.createContainer(leaflet, map),
      );
      return map;
    } catch (error) {
      console.error('Error creating map:', error);
      this.destroyMap();
      return undefined;
    }
  }

  public useDefaultLocation(): void {
    this.map?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  /**
   * Emits the move for the debounced refresh and returns the locations
   * inside the bounds (none while the first markers are being added).
   */
  public getLocationsByMapBounds(
    bounds: MapBounds & { isZoomChange?: boolean },
  ): Observable<WeatherLocation[]> {
    this.mapMoves.next({
      ...bounds,
      isZoomChange: bounds.isZoomChange ?? false,
    });

    if (this.isInitializing && this.markersAddedDuringInit) {
      return of([]);
    }
    return this.overpass.fetchLocations(bounds, this.currentZoomLevel);
  }

  public addWeatherMarkers(onMarkerClick?: MarkerClickCallback): void {
    if (!this.map || !this.markerLayer || this.markersAddedDuringInit) {
      return;
    }
    this.markersAddedDuringInit = true;
    setTimeout(() => {
      this.isInitializing = false;
    }, INIT_PHASE_MS);

    this.currentZoomLevel = this.map.getZoom();
    this.markerClickCallback = onMarkerClick;
    this.markerLayer.clear();

    const mapBounds = this.currentBounds(true);
    if (!mapBounds) {
      return;
    }
    this.getLocationsByMapBounds(mapBounds).subscribe({
      next: (locations) =>
        this.addMarkersForLocations(locations, onMarkerClick),
      error: (error: unknown) =>
        console.error('Error fetching locations:', error),
    });
  }

  /** Refreshes the markers whenever the user zooms or pans the map. */
  public updateMarkersOnMapChange(onMarkerClick?: MarkerClickCallback): void {
    const map = this.map;
    if (!map) {
      return;
    }
    this.markerClickCallback = onMarkerClick;

    // Leaflet fires `zoomend` and then `moveend` for a zoom: only the first one
    // must refresh the markers, as a full refresh and not as a simple pan.
    let zoomed = false;
    map.on('zoomend', () => {
      zoomed = true;
      this.currentZoomLevel = map.getZoom();
      this.emitMove(true);
    });

    map.on('moveend', () => {
      if (zoomed) {
        zoomed = false;
        return;
      }
      this.emitMove(false);
    });
  }

  /**
   * @param clearAll true removes every marker; false only the ones outside
   * of the current view.
   */
  public clearMarkers(clearAll = true): void {
    if (clearAll) {
      this.markerLayer?.clear();
      this.markersAddedDuringInit = false;
      this.isInitializing = false;
      return;
    }
    const bounds = this.map?.getBounds();
    if (bounds) {
      this.markerLayer?.removeOutside(bounds);
    }
  }

  public async reloadLeaflet(containerId = 'map'): Promise<void> {
    if (!this.isBrowser) {
      return;
    }
    this.markersAddedDuringInit = false;
    this.isInitializing = true;
    this.destroyMap();

    try {
      await new Promise((resolve) => setTimeout(resolve, RELOAD_DELAY_MS));
      const leaflet = await this.ensureLeafletLoaded();
      if (!leaflet?.Map) {
        console.error('Failed to reload Leaflet after multiple attempts');
        return;
      }
      this.initMap(containerId);
    } catch (error) {
      console.error('Error reloading Leaflet:', error);
    }
  }

  private addMarkersForLocations(
    locations: WeatherLocation[],
    onMarkerClick?: MarkerClickCallback,
  ): void {
    if (!this.map || !this.markerLayer) {
      return;
    }
    for (const location of locations) {
      if (this.markerLayer.has(location.id)) {
        continue;
      }
      this.weatherService.getWeatherForLocation(location).subscribe({
        next: (weatherData) => {
          if (weatherData) {
            this.markerLayer?.add(weatherData, onMarkerClick);
          }
        },
        error: (error: unknown) =>
          console.error(`Error fetching weather for ${location.name}:`, error),
      });
    }
  }

  private emitMove(isZoomChange: boolean): void {
    const bounds = this.currentBounds(isZoomChange);
    if (bounds) {
      this.mapMoves.next(bounds);
    }
  }

  private currentBounds(isZoomChange: boolean): MapMove | undefined {
    try {
      const bounds = this.map?.getBounds();
      return bounds
        ? {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
            isZoomChange,
          }
        : undefined;
    } catch (error) {
      console.error('Error getting map bounds:', error);
      return undefined;
    }
  }

  /** Clusters nearby markers when the plugin is available. */
  private createContainer(
    leaflet: LeafletNamespace,
    map: Leaflet.Map,
  ): MarkerContainer {
    let container: Leaflet.FeatureGroup | Leaflet.LayerGroup;
    if (typeof leaflet.markerClusterGroup === 'function') {
      container = leaflet.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 12,
      });
    } else {
      console.warn('Marker clustering is unavailable, using regular markers');
      container = new leaflet.LayerGroup();
    }
    container.addTo(map);
    return container;
  }

  private destroyMap(): void {
    try {
      this.map?.remove();
    } catch (error) {
      console.error('Error removing map:', error);
    }
    this.map = undefined;
    this.markerLayer = undefined;
  }
}
