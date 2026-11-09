import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import type * as Leaflet from 'leaflet';

export type LeafletNamespace = typeof Leaflet;

interface LeafletGlobal {
  L?: LeafletNamespace;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

/**
 * Loads Leaflet (and its marker cluster plugin) lazily and only in the browser.
 * The plugin expects a global `L`, so it must be imported after it is set.
 */
@Injectable({ providedIn: 'root' })
export class LeafletLoader {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private loading: Promise<LeafletNamespace | null> | null = null;

  load(forceReload = false): Promise<LeafletNamespace | null> {
    if (!this.isBrowser) {
      return Promise.resolve(null);
    }
    if (forceReload || !this.loading) {
      this.loading = this.loadWithRetries();
    }
    return this.loading;
  }

  private async loadWithRetries(): Promise<LeafletNamespace | null> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * attempt),
        );
      }
      try {
        const leaflet = await this.importLeaflet();
        if (leaflet?.Map) {
          return leaflet;
        }
      } catch (error) {
        console.error('Error loading Leaflet:', error);
      }
    }
    this.loading = null;
    return null;
  }

  private async importLeaflet(): Promise<LeafletNamespace> {
    const root = globalThis as LeafletGlobal;
    if (!root.L?.Map) {
      const module = await import('leaflet');
      // Leaflet is CommonJS: depending on the bundler the API is on `default`.
      root.L = ((module as { default?: LeafletNamespace }).default ??
        module) as LeafletNamespace;
    }
    try {
      await this.importClusterPlugin();
    } catch (error) {
      console.warn('Marker clustering is unavailable:', error);
    }
    return root.L;
  }

  private importClusterPlugin(): Promise<unknown> {
    return import('leaflet.markercluster');
  }
}
