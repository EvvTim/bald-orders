import { describe, expect, it } from 'vitest';
import { buildMapsUrl, buildSingleMapsUrl, locationKey, parseLocation, splitCountry } from './location';

describe('parseLocation', () => {
  it('splits a newline-delimited block into name/street/countryCity', () => {
    expect(parseLocation('Acme Corp\nMain St 1\nNL Rotterdam')).toEqual({
      name: 'Acme Corp',
      street: 'Main St 1',
      countryCity: 'NL Rotterdam',
    });
  });

  it('trims lines and drops blank ones', () => {
    expect(parseLocation('  Acme Corp  \n\n  Main St 1  \n')).toEqual({
      name: 'Acme Corp',
      street: 'Main St 1',
      countryCity: '',
    });
  });

  it('handles empty/undefined input', () => {
    expect(parseLocation(undefined)).toEqual({ name: '', street: '', countryCity: '' });
  });
});

describe('splitCountry', () => {
  it('splits a leading two-letter country code', () => {
    expect(splitCountry('NL Rotterdam')).toEqual({ cc: 'NL', rest: 'Rotterdam' });
  });

  it('returns a null code when there is none', () => {
    expect(splitCountry('Rotterdam')).toEqual({ cc: null, rest: 'Rotterdam' });
  });

  it('handles empty input', () => {
    expect(splitCountry('')).toEqual({ cc: null, rest: '' });
    expect(splitCountry(undefined)).toEqual({ cc: null, rest: '' });
  });
});

describe('locationKey', () => {
  it('joins and lowercases the location fields', () => {
    expect(locationKey({ name: 'Acme', street: 'Main St 1', countryCity: 'NL Rotterdam' })).toBe(
      'acme|main st 1|nl rotterdam'
    );
  });
});

describe('buildSingleMapsUrl', () => {
  it('builds a Google Maps search URL', () => {
    const url = buildSingleMapsUrl({ name: 'Acme', street: 'Main St 1', countryCity: 'NL Rotterdam' });
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=Acme%2C+Main+St+1%2C+NL+Rotterdam'
    );
  });

  it('returns null for an empty location', () => {
    expect(buildSingleMapsUrl({ name: '', street: '', countryCity: '' })).toBeNull();
  });
});

describe('buildMapsUrl', () => {
  const loadLoc = { name: 'Acme', street: 'Main St 1', countryCity: 'NL Rotterdam' };
  const unloadLoc = { name: 'Beta', street: 'Second St 2', countryCity: 'DE Berlin' };

  it('builds a Google Maps directions URL from both stops', () => {
    const url = buildMapsUrl(loadLoc, unloadLoc);
    expect(url).toContain('https://www.google.com/maps/dir/?');
    expect(url).toContain('origin=Acme%2C+Main+St+1%2C+NL+Rotterdam');
    expect(url).toContain('destination=Beta%2C+Second+St+2%2C+DE+Berlin');
    expect(url).toContain('travelmode=driving');
  });

  it('returns null when either stop is empty', () => {
    expect(buildMapsUrl({ name: '', street: '', countryCity: '' }, unloadLoc)).toBeNull();
    expect(buildMapsUrl(loadLoc, { name: '', street: '', countryCity: '' })).toBeNull();
  });
});
