import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TUI_ENGLISH_LANGUAGE, TUI_SPANISH_LANGUAGE } from '@taiga-ui/i18n';
import { GlobalServiceService } from './global-service.service';
import { LocalStorageService } from './local-storage.service';

describe('GlobalServiceService', () => {
  const translate = { use: vi.fn() };
  const router = { navigate: vi.fn() };
  const storage = { setItem: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: translate },
        { provide: Router, useValue: router },
        { provide: LocalStorageService, useValue: storage },
      ],
    });
  });

  it('switches language, updates Taiga and persists the selection', () => {
    const service = TestBed.inject(GlobalServiceService);
    expect(service.tuiLanguage()).toBe(TUI_SPANISH_LANGUAGE);
    const language = service.settings()['preferences'][0];
    language.fn?.(language);
    expect(service.selectedLanguage()).toBe('en');
    expect(service.tuiLanguage()).toBe(TUI_ENGLISH_LANGUAGE);
    expect(translate.use).toHaveBeenCalledWith('en');
    expect(storage.setItem).toHaveBeenCalledWith('language', 'en');
    language.fn?.(language);
    expect(service.selectedLanguage()).toBe('es');
  });

  it('switches the theme and navigates to the profile', () => {
    const service = TestBed.inject(GlobalServiceService);
    const theme = service.settings()['preferences'][1];
    theme.fn?.(theme);
    expect(service.selectedTheme()).toBe('dark');
    expect(storage.setItem).toHaveBeenCalledWith('theme', 'dark');
    const profile = service.settings()['account'][0];
    profile.fn?.(profile);
    expect(router.navigate).toHaveBeenCalledWith(['/profile']);
    theme.fn?.(theme);
    expect(service.selectedTheme()).toBe('light');
  });

  it('logs the entries without a dedicated action', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const service = TestBed.inject(GlobalServiceService);
    const entries = [
      ...Object.values(service.drawer()).flat(),
      service.settings()['account'][1],
    ];
    for (const entry of entries) {
      entry.fn?.(entry);
    }
    expect(log).toHaveBeenCalledTimes(entries.length);
    expect(log).toHaveBeenCalledWith('Map');
    log.mockRestore();
  });

  it('shows the icon of the selected theme and language', () => {
    const service = TestBed.inject(GlobalServiceService);
    expect(service.settings()['preferences'][1].icon).toBe('@tui.moon');
    service.selectedTheme.set('dark');
    service.selectedLanguage.set('en');
    expect(service.settings()['preferences'][1].icon).toBe('@tui.sun');
    expect(service.settings()['preferences'][0].icon).toContain('gb');
  });
});
