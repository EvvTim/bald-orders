import type { Location } from './types';

export function parseLocation(raw: string | undefined | null): Location {
  const lines = (raw || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    name: lines[0] || '',
    street: lines[1] || '',
    countryCity: lines[2] || '',
  };
}

export function splitCountry(countryCity: string | undefined | null): { cc: string | null; rest: string } {
  const m = (countryCity || '').match(/^([A-Z]{2})\s+(.+)$/);
  if (m) return { cc: m[1], rest: m[2] };
  return { cc: null, rest: countryCity || '' };
}

export function buildMapsUrl(loadLoc: Location, unloadLoc: Location): string | null {
  const origin = [loadLoc.name, loadLoc.street, loadLoc.countryCity].filter(Boolean).join(', ');
  const destination = [unloadLoc.name, unloadLoc.street, unloadLoc.countryCity].filter(Boolean).join(', ');
  if (!origin || !destination) return null;
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildSingleMapsUrl(loc: Location): string | null {
  const q = [loc.name, loc.street, loc.countryCity].filter(Boolean).join(', ');
  if (!q) return null;
  const params = new URLSearchParams({ api: '1', query: q });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function locationKey(loc: Location): string {
  return [loc.name, loc.street, loc.countryCity].join('|').toLowerCase();
}
