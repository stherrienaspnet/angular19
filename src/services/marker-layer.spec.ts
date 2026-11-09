import { createBounds, FakeLayerGroup, FakeMarker, createFakeLeaflet } from '../testing/fake-leaflet';
import { MarkerLayer } from './marker-layer';
import type { WeatherData } from './weather.service';

function weather(id: string, latitude = 40, longitude = -3, name = 'Madrid'): WeatherData {
  return {
    location: { id, name, latitude, longitude, capital: 1 },
    temperature: 20,
    description: 'Soleado',
    humidity: 40,
    windSpeed: 5,
    precipitation: 0,
    date: '2025-01-01',
    icon: 'sun',
  };
}

describe('MarkerLayer', () => {
  function setup() {
    const container = new FakeLayerGroup();
    const leaflet = createFakeLeaflet();
    const layer = new MarkerLayer(leaflet, container as never);
    return { layer, container };
  }

  it('adds one marker per location with an escaped popup', () => {
    const { layer, container } = setup();
    const marker = layer.add(weather('1', 40, -3, '<script>x</script>')) as unknown as FakeMarker;
    expect(marker.latlng).toEqual([40, -3]);
    expect(marker.bindPopup).toHaveBeenCalledWith(
      '<b>&lt;script&gt;x&lt;/script&gt;</b><br>20°C - Soleado',
    );
    expect(container.addLayer).toHaveBeenCalledWith(marker);
    expect(layer.has('1')).toBe(true);
    expect(layer.count).toBe(1);
    expect(layer.add(weather('1'))).toBeNull();
    expect(layer.count).toBe(1);
  });

  it('notifies when a marker is clicked', () => {
    const { layer } = setup();
    const onClick = vi.fn();
    const data = weather('1');
    (layer.add(data, onClick) as unknown as FakeMarker).click();
    expect(onClick).toHaveBeenCalledWith(data);
  });

  it('does not register a click handler without a callback', () => {
    const { layer } = setup();
    const marker = layer.add(weather('1')) as unknown as FakeMarker;
    expect(marker.on).not.toHaveBeenCalled();
  });

  it('returns null when the marker cannot be created', () => {
    const { layer, container } = setup();
    container.addLayer.mockImplementation(() => {
      throw new Error('boom');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(layer.add(weather('1'))).toBeNull();
    expect(layer.has('1')).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it('removes every marker when cleared, tolerating removal errors', () => {
    const { layer, container } = setup();
    const first = layer.add(weather('1')) as unknown as FakeMarker;
    const second = layer.add(weather('2')) as unknown as FakeMarker;
    first.remove.mockImplementation(() => {
      throw new Error('boom');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    layer.clear();
    expect(second.remove).toHaveBeenCalled();
    expect(container.clearLayers).toHaveBeenCalled();
    expect(layer.count).toBe(0);
    expect(layer.has('1')).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('only removes the markers outside of the bounds', () => {
    const { layer, container } = setup();
    const inside = layer.add(weather('1', 40, -3)) as unknown as FakeMarker;
    const outside = layer.add(weather('2', 60, 20)) as unknown as FakeMarker;
    const removed = layer.removeOutside(createBounds() as never);
    expect(removed).toBe(1);
    expect(container.removeLayer).toHaveBeenCalledWith(outside);
    expect(outside.remove).toHaveBeenCalled();
    expect(inside.remove).not.toHaveBeenCalled();
    expect(layer.has('2')).toBe(false);
    expect(layer.has('1')).toBe(true);
    expect(layer.count).toBe(1);
  });
});
