import { firstValueFrom } from 'rxjs';
import {
  config,
  TranslateServerLoader,
  translateServerLoaderFactory,
} from './app.config.server';

describe('server configuration', () => {
  it('creates the filesystem translation loader', () => {
    expect(translateServerLoaderFactory()).toBeInstanceOf(TranslateServerLoader);
  });

  it('extends the application providers with the server ones', () => {
    expect(config.providers.length).toBeGreaterThan(0);
  });
});

describe('TranslateServerLoader', () => {
  it('loads the Spanish translations from disk', async () => {
    const translations = await firstValueFrom(new TranslateServerLoader().getTranslation('es'));
    expect(Object.keys(translations).length).toBeGreaterThan(0);
  });

  it('reports an error for a missing translation file', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await firstValueFrom(new TranslateServerLoader().getTranslation('missing'))).toEqual({});
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
