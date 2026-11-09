import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it.each(['browser', 'server'])('stores and removes values on %s', (platformId) => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platformId }],
    });
    const storage = TestBed.inject(LocalStorageService);

    expect(storage.getItem('missing')).toBeNull();
    storage.setItem('first', 'value');
    storage.setItem('second', 'other');
    expect(storage.getItem('first')).toBe('value');
    storage.removeItem('first');
    expect(storage.getItem('first')).toBeNull();
    storage.clear();
    expect(storage.getItem('second')).toBeNull();
  });

  it('does not access browser storage on the server', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const storage = TestBed.inject(LocalStorageService);
    storage.setItem('server-only', 'value');
    expect(localStorage.getItem('server-only')).toBeNull();
  });
});
