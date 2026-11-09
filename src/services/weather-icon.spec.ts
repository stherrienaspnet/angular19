import { escapeHtml, weatherEmoji, weatherIconHtml } from './weather-icon';

describe('weather icons', () => {
  it.each([
    ['sun', '☀️'],
    ['cloud-sun', '⛅'],
    ['cloud', '☁️'],
    ['foggy', '🌁'],
    ['cloud-sun-rain', '🌦️'],
    ['cloud-rain', '🌧️'],
    ['cloud-showers-heavy', '⛈️'],
    ['bolt', '⚡'],
    ['snowflake', '❄️'],
    ['question', '❓'],
    ['unknown-icon', '?'],
  ])('maps %s to %s', (name, emoji) => {
    expect(weatherEmoji(name)).toBe(emoji);
  });

  it('wraps the emoji in the marker html', () => {
    expect(weatherIconHtml('sun')).toContain('☀️</div>');
  });

  it('escapes html special characters', () => {
    expect(escapeHtml(`<b a="1">'&'</b>`)).toBe(
      '&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;',
    );
  });
});
