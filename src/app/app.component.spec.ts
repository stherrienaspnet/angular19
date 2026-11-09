import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { GlobalServiceService, LocalStorageService } from '../services';

describe('AppComponent preferences', () => {
  it('restores valid saved language and theme', () => {
    const global = { selectedLanguage: signal('es'), selectedTheme: signal('light') };
    const storage = {
      getItem: (key: string) => key === 'language' ? 'en' : 'dark',
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: GlobalServiceService, useValue: global },
        { provide: LocalStorageService, useValue: storage },
      ],
    }).overrideComponent(AppComponent, { set: { template: '', imports: [] } });
    TestBed.createComponent(AppComponent);
    expect(global.selectedLanguage()).toBe('en');
    expect(global.selectedTheme()).toBe('dark');
  });

  it('ignores invalid saved preferences', () => {
    const global = { selectedLanguage: signal('es'), selectedTheme: signal('light') };
    TestBed.configureTestingModule({
      providers: [
        { provide: GlobalServiceService, useValue: global },
        { provide: LocalStorageService, useValue: { getItem: () => 'invalid' } },
      ],
    }).overrideComponent(AppComponent, { set: { template: '', imports: [] } });
    TestBed.createComponent(AppComponent);
    expect(global.selectedLanguage()).toBe('es');
    expect(global.selectedTheme()).toBe('light');
  });
});
