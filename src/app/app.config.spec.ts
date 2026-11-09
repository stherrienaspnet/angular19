import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TUI_LANGUAGE } from '@taiga-ui/i18n';
import { TUI_ENGLISH_LANGUAGE, TUI_SPANISH_LANGUAGE } from '@taiga-ui/i18n';
import { Router } from '@angular/router';
import { GlobalServiceService, LocalStorageService } from '../services';
import { appConfig } from './app.config';
import { routes } from './app.routes';

describe('appConfig', () => {
  function configure() {
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LocalStorageService, useValue: { getItem: () => null, setItem: () => undefined } },
      ],
    });
  }

  it('loads the translations over http', () => {
    configure();
    expect(TestBed.inject(TranslateLoader)).toBeInstanceOf(TranslateHttpLoader);
  });

  it('keeps the Taiga language in sync with the selected language', () => {
    configure();
    const global = TestBed.inject(GlobalServiceService);
    const languages: unknown[] = [];
    TestBed.inject(TUI_LANGUAGE).subscribe((language) => languages.push(language));
    TestBed.tick();
    expect(languages.at(-1)).toBe(TUI_SPANISH_LANGUAGE);

    global.selectedLanguage.set('en');
    TestBed.tick();
    expect(languages.at(-1)).toBe(TUI_ENGLISH_LANGUAGE);
  });
});

describe('routes', () => {
  it('redirects the root to the home page', () => {
    expect(routes.find((route) => route.path === '')).toMatchObject({
      redirectTo: 'home',
      pathMatch: 'full',
    });
  });

  it.each([
    ['home', 'HomeComponent'],
    ['profile', 'ProfileComponent'],
  ])('lazy loads the %s page', async (path, name) => {
    const route = routes.find((item) => item.path === path);
    const component = await (route?.loadComponent as () => Promise<{ name: string }>)();
    expect(component.name).toBe(name);
  });

  it('can be used by the router', () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClient(), provideHttpClientTesting()],
    });
    expect(TestBed.inject(Router).config).toEqual(routes);
  });
});
