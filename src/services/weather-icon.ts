const WEATHER_EMOJI: Readonly<Record<string, string>> = {
  sun: '☀️',
  'cloud-sun': '⛅',
  cloud: '☁️',
  foggy: '🌁',
  'cloud-sun-rain': '🌦️',
  'cloud-rain': '🌧️',
  'cloud-showers-heavy': '⛈️',
  bolt: '⚡',
  snowflake: '❄️',
  question: '❓',
};

export function weatherEmoji(iconName: string): string {
  return WEATHER_EMOJI[iconName] ?? '?';
}

export function weatherIconHtml(iconName: string): string {
  return `<div style="font-size: 24px; text-align: center; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; padding: 2px; border-radius: 50%;">${weatherEmoji(iconName)}</div>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
