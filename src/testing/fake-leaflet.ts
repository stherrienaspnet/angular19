import { vi } from 'vitest';
import type { LeafletNamespace } from '../services/leaflet-loader';

export interface FakeBounds {
  getNorth(): number;
  getSouth(): number;
  getEast(): number;
  getWest(): number;
  contains(point: { lat: number; lng: number }): boolean;
}

export function createBounds(
  north = 45,
  south = 35,
  east = 0,
  west = -10,
): FakeBounds {
  return {
    getNorth: () => north,
    getSouth: () => south,
    getEast: () => east,
    getWest: () => west,
    contains: ({ lat, lng }) =>
      lat >= south && lat <= north && lng >= west && lng <= east,
  };
}

export class FakeLayerGroup {
  layers: unknown[] = [];
  addTo = vi.fn(() => this);
  addLayer = vi.fn((layer: unknown) => {
    this.layers.push(layer);
    return this;
  });
  removeLayer = vi.fn((layer: unknown) => {
    this.layers = this.layers.filter((item) => item !== layer);
    return this;
  });
  clearLayers = vi.fn(() => {
    this.layers = [];
    return this;
  });
}

export class FakeMarker {
  handlers = new Map<string, () => void>();
  bindPopup = vi.fn();
  remove = vi.fn();
  on = vi.fn((event: string, handler: () => void) => {
    this.handlers.set(event, handler);
    return this;
  });

  constructor(
    public latlng: [number, number],
    public options: { icon?: unknown },
  ) {}

  getLatLng(): { lat: number; lng: number } {
    return { lat: this.latlng[0], lng: this.latlng[1] };
  }

  click(): void {
    this.handlers.get('click')?.();
  }
}

export class FakeMap {
  static instances: FakeMap[] = [];

  zoom = 6;
  bounds: FakeBounds | undefined = createBounds();
  listeners = new Map<string, () => void>();
  setView = vi.fn(() => this);
  remove = vi.fn();
  on = vi.fn((event: string, handler: () => void) => {
    this.listeners.set(event, handler);
    return this;
  });

  constructor(
    public id: string,
    public options: unknown,
  ) {
    FakeMap.instances.push(this);
  }

  getZoom(): number {
    return this.zoom;
  }

  getBounds(): FakeBounds | undefined {
    return this.bounds;
  }

  /** Emulates Leaflet, which fires `zoomend` and then `moveend` for a zoom. */
  zoomTo(zoom: number): void {
    this.zoom = zoom;
    this.listeners.get('zoomend')?.();
    this.listeners.get('moveend')?.();
  }

  pan(): void {
    this.listeners.get('moveend')?.();
  }
}

export interface FakeLeaflet extends LeafletNamespace {
  tileLayerAddTo: ReturnType<typeof vi.fn>;
  clusterGroups: FakeLayerGroup[];
}

export function createFakeLeaflet(withClusters = true): FakeLeaflet {
  FakeMap.instances = [];
  const tileLayerAddTo = vi.fn();
  const clusterGroups: FakeLayerGroup[] = [];
  const leaflet = {
    Map: FakeMap,
    Marker: FakeMarker,
    LayerGroup: FakeLayerGroup,
    Icon: { Default: {} as { imagePath?: string } },
    divIcon: vi.fn((options: unknown) => options),
    tileLayer: vi.fn(() => ({ addTo: tileLayerAddTo })),
    tileLayerAddTo,
    clusterGroups,
    ...(withClusters && {
      markerClusterGroup: vi.fn(() => {
        const group = new FakeLayerGroup();
        clusterGroups.push(group);
        return group;
      }),
    }),
  };
  return leaflet as unknown as FakeLeaflet;
}
