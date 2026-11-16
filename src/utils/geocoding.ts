export interface GeocodingResult {
  displayName: string;
  lat: number;
  lon: number;
}

export async function searchLocation(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return [];

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'it');

    // Browser UA is sent automatically; Referer identifies Bacaro Tour for Nominatim policy.
    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'it',
        Accept: 'application/json',
        Referer:
          typeof window !== 'undefined'
            ? window.location.href
            : 'https://bacaro-tour.local/',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();

    return data.map(
      (item: { display_name: string; lat: string; lon: string }) => ({
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      })
    );
  } catch {
    return [];
  }
}

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lon.toString());
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'it',
        Accept: 'application/json',
        Referer:
          typeof window !== 'undefined'
            ? window.location.href
            : 'https://bacaro-tour.local/',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.display_name
    );
  } catch {
    return null;
  }
}
