/**
 * Coarse geographic reference data used by the impossible-travel and
 * unusual-hour signals.
 *
 * Centroids are country-level approximations (capital-city coordinates) and
 * UTC offsets are standard-time offsets. That precision is deliberate: the
 * engine only needs "could a human physically get from A to B in this time?"
 * and "roughly what local hour is it there?", not real geolocation
 * (SPEC: real IP intelligence is out of scope).
 */

interface CountryGeo {
  lat: number;
  lon: number;
  /** Standard UTC offset in hours (may be fractional, e.g. 5.5 for India). */
  utcOffset: number;
}

export const COUNTRY_GEO: Record<string, CountryGeo> = {
  IN: { lat: 28.61, lon: 77.21, utcOffset: 5.5 },
  US: { lat: 38.9, lon: -77.04, utcOffset: -5 },
  GB: { lat: 51.51, lon: -0.13, utcOffset: 0 },
  DE: { lat: 52.52, lon: 13.4, utcOffset: 1 },
  FR: { lat: 48.85, lon: 2.35, utcOffset: 1 },
  NL: { lat: 52.37, lon: 4.9, utcOffset: 1 },
  RU: { lat: 55.76, lon: 37.62, utcOffset: 3 },
  CN: { lat: 39.9, lon: 116.4, utcOffset: 8 },
  JP: { lat: 35.68, lon: 139.69, utcOffset: 9 },
  SG: { lat: 1.35, lon: 103.82, utcOffset: 8 },
  AU: { lat: -33.87, lon: 151.21, utcOffset: 10 },
  BR: { lat: -15.79, lon: -47.88, utcOffset: -3 },
  NG: { lat: 9.06, lon: 7.49, utcOffset: 1 },
  AE: { lat: 25.2, lon: 55.27, utcOffset: 4 },
  CA: { lat: 45.42, lon: -75.7, utcOffset: -5 },
  ZA: { lat: -25.75, lon: 28.19, utcOffset: 2 },
  KR: { lat: 37.57, lon: 126.98, utcOffset: 9 },
  ID: { lat: -6.21, lon: 106.85, utcOffset: 7 },
  PK: { lat: 33.73, lon: 73.09, utcOffset: 5 },
  BD: { lat: 23.81, lon: 90.41, utcOffset: 6 },
};

/** Great-circle distance in kilometres between two country centroids. */
export function distanceKm(a: string, b: string): number | null {
  const ga = COUNTRY_GEO[a];
  const gb = COUNTRY_GEO[b];
  if (!ga || !gb) return null;
  const R = 6371;
  const dLat = ((gb.lat - ga.lat) * Math.PI) / 180;
  const dLon = ((gb.lon - ga.lon) * Math.PI) / 180;
  const lat1 = (ga.lat * Math.PI) / 180;
  const lat2 = (gb.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Local hour (0–23) at the given instant in the given country, using the
 * country's standard UTC offset. Returns null for unknown countries.
 */
export function localHour(isoTimestamp: string, country: string): number | null {
  const geo = COUNTRY_GEO[country];
  if (!geo) return null;
  const ms = Date.parse(isoTimestamp);
  if (Number.isNaN(ms)) return null;
  const local = new Date(ms + geo.utcOffset * 3600_000);
  return local.getUTCHours();
}
