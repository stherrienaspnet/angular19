import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LeafletLoader } from './leaflet-loader';

const fakeLeaflet = vi.hoisted(() => ({ Map: class {}, marker: 'leaflet' }));

vi.mock('leaflet', () => ({ default: fakeLeaflet }));
vi.mock('leaflet.markercluster', () => ({}));

describe('LeafletLoader', () => {
  function create(platformId = 'browser'): LeafletLoader {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platformId }],
    });
    return TestBed.inject(LeafletLoader);
  }

  afterEach(() => {
    delete (globalThis as { L?: unknown }).L;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not load anything on the server', async () => {
    expect(await create('server').load()).toBeNull();
    expect((globalThis as { L?: unknown }).L).toBeUndefined();
  });

  it('loads Leaflet from the default export and publishes it globally', async () => {
    const leaflet = await create().load();
    expect(leaflet).toBe(fakeLeaflet);
    expect((globalThis as { L?: unknown }).L).toBe(fakeLeaflet);
  });

  it('shares the loading between calls and reloads on demand', async () => {
    const loader = create();
    const first = loader.load();
    expect(loader.load()).toBe(first);
    expect(loader.load(true)).not.toBe(first);
  });

  it('reuses a Leaflet already available globally', async () => {
    const existing = { Map: class {} };
    (globalThis as { L?: unknown }).L = existing;
    expect(await create().load()).toBe(existing);
  });

  it('works without the marker cluster plugin', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const loader = create();
    vi.spyOn(
      loader as unknown as { importClusterPlugin(): Promise<unknown> },
      'importClusterPlugin',
    ).mockRejectedValue(new Error('plugin missing'));
    expect(await loader.load()).toBe(fakeLeaflet);
    expect(warn).toHaveBeenCalled();
  });

  it('retries and gives up when Leaflet is unusable', async () => {
    vi.useFakeTimers();
    const unusable = {};
    (globalThis as { L?: unknown }).L = undefined;
    const loader = create();
    vi.spyOn(
      loader as unknown as { importLeaflet(): Promise<unknown> },
      'importLeaflet',
    ).mockResolvedValue(unusable);
    const result = loader.load();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toBeNull();
  });

  it('retries after an import error and recovers', async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loader = create();
    vi.spyOn(
      loader as unknown as { importLeaflet(): Promise<unknown> },
      'importLeaflet',
    )
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(fakeLeaflet);
    const result = loader.load();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toBe(fakeLeaflet);
    expect(error).toHaveBeenCalled();
  });
});
