import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GlobalServiceService, OptionsItem, SearchData } from '../../services';
import { HeaderComponent } from './header.component';

interface HeaderInternals {
  control: { setValue(value: string | null): void };
  results$: import('rxjs').Observable<SearchData | null>;
  onClick(item: OptionsItem): void;
}

describe('HeaderComponent', () => {
  const searchData = signal<SearchData>({
    Zones: [{ title: 'Onil', href: 'https://example.com/onil' }],
    Crags: [{ title: 'El Tormo', href: 'https://example.com/tormo', subtitle: 'Near Alicante' }],
  });

  function create(): HeaderInternals {
    TestBed.configureTestingModule({
      providers: [{ provide: GlobalServiceService, useValue: { searchData } }],
    }).overrideComponent(HeaderComponent, {
      set: { imports: [], template: '' },
    });
    return TestBed.createComponent(HeaderComponent).componentInstance as unknown as HeaderInternals;
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not search for an empty value', () => {
    const header = create();
    const results: unknown[] = [];
    header.results$.subscribe((value) => results.push(value));
    header.control.setValue('');
    header.control.setValue(null);
    expect(results).toEqual([]);
  });

  it('shows a loading state and then the matching results', async () => {
    const header = create();
    const results: (SearchData | null)[] = [];
    header.results$.subscribe((value) => results.push(value));

    header.control.setValue('tormo');
    expect(results).toEqual([null]);
    await vi.advanceTimersByTimeAsync(2000);

    expect(results).toHaveLength(2);
    expect(results[1]).toEqual({
      Zones: [],
      Crags: [{ title: 'El Tormo', href: 'https://example.com/tormo', subtitle: 'Near Alicante' }],
    });
  });

  it('only keeps the results of the latest search', async () => {
    const header = create();
    const results: (SearchData | null)[] = [];
    header.results$.subscribe((value) => results.push(value));

    header.control.setValue('onil');
    await vi.advanceTimersByTimeAsync(1000);
    header.control.setValue('tormo');
    await vi.advanceTimersByTimeAsync(2000);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.at(-1)?.['Crags']).toHaveLength(1);
  });

  it('runs the action of the clicked item', () => {
    const header = create();
    const fn = vi.fn();
    const item = { name: 'Map', icon: '@tui.map', fn };
    header.onClick(item);
    expect(fn).toHaveBeenCalledWith(item);
    expect(() => header.onClick({ name: 'No action', icon: '@tui.file' })).not.toThrow();
  });
});
