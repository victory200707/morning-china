import {
  Body,
  Equator,
  Horizon,
  Observer,
  SearchAltitude,
  SearchRiseSet,
  Seasons,
  SiderealTime,
} from "astronomy-engine";

export const BEIJING_TIME_ZONE = "Asia/Shanghai";
export const BEIJING_UTC_OFFSET_HOURS = 8;
export const STANDARD_SUNRISE_CENTER_ALTITUDE_DEG = -0.833;

export type MorningLightStage =
  | "deep-night"
  | "astronomical-twilight"
  | "nautical-twilight"
  | "civil-twilight"
  | "daylight";

export interface GeoPoint {
  latitude: number;
  longitude: number;
  elevationMeters?: number;
}

export interface SolarHorizontalPosition {
  geometricAltitudeDeg: number;
  azimuthDeg: number;
}

export interface SolarEquatorialState {
  rightAscensionHours: number;
  declinationDeg: number;
  greenwichSiderealHours: number;
}

export interface MorningEvents {
  astronomicalDawn: Date | null;
  nauticalDawn: Date | null;
  civilDawn: Date | null;
  sunrise: Date | null;
  sunset: Date | null;
}

export interface SeasonInstants {
  marchEquinox: Date;
  juneSolstice: Date;
  septemberEquinox: Date;
  decemberSolstice: Date;
}

function assertPoint(point: GeoPoint): void {
  if (point.latitude < -90 || point.latitude > 90) {
    throw new RangeError("Latitude must be between -90 and 90 degrees.");
  }
  if (point.longitude < -180 || point.longitude > 180) {
    throw new RangeError("Longitude must be between -180 and 180 degrees.");
  }
}

function toDate(value: { date: Date } | null): Date | null {
  return value?.date ?? null;
}

export function beijingDateStartUtc(dateIso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    throw new TypeError("Beijing date must use YYYY-MM-DD format.");
  }
  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.valueOf())) {
    throw new RangeError("Beijing date is not a valid calendar date.");
  }
  const roundTrip = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  if (roundTrip !== dateIso) {
    throw new RangeError("Beijing date is not a valid calendar date.");
  }
  return date;
}

export function classifyMorningLight(
  geometricAltitudeDeg: number,
): MorningLightStage {
  if (geometricAltitudeDeg < -18) return "deep-night";
  if (geometricAltitudeDeg < -12) return "astronomical-twilight";
  if (geometricAltitudeDeg < -6) return "nautical-twilight";
  if (geometricAltitudeDeg < STANDARD_SUNRISE_CENTER_ALTITUDE_DEG) {
    return "civil-twilight";
  }
  return "daylight";
}

export function getSolarHorizontalPosition(
  instant: Date,
  point: GeoPoint,
): SolarHorizontalPosition {
  assertPoint(point);
  const observer = new Observer(
    point.latitude,
    point.longitude,
    point.elevationMeters ?? 0,
  );
  const equatorial = Equator(Body.Sun, instant, observer, true, true);
  const horizontal = Horizon(
    instant,
    observer,
    equatorial.ra,
    equatorial.dec,
  );

  return {
    geometricAltitudeDeg: horizontal.altitude,
    azimuthDeg: horizontal.azimuth,
  };
}

export function getSolarEquatorialState(instant: Date): SolarEquatorialState {
  // Solar parallax is below this project's 0.01-degree map-field tolerance.
  const referenceObserver = new Observer(0, 0, 0);
  const equatorial = Equator(Body.Sun, instant, referenceObserver, true, true);

  return {
    rightAscensionHours: equatorial.ra,
    declinationDeg: equatorial.dec,
    greenwichSiderealHours: SiderealTime(instant),
  };
}

export function geometricAltitudeFromState(
  state: SolarEquatorialState,
  point: GeoPoint,
): number {
  assertPoint(point);
  const radians = Math.PI / 180;
  const latitude = point.latitude * radians;
  const declination = state.declinationDeg * radians;
  const localHourAngle =
    (15 *
      (state.greenwichSiderealHours - state.rightAscensionHours) +
      point.longitude) *
    radians;

  return (
    Math.asin(
      Math.sin(latitude) * Math.sin(declination) +
        Math.cos(latitude) * Math.cos(declination) * Math.cos(localHourAngle),
    ) / radians
  );
}

export function getMorningEvents(
  beijingDateIso: string,
  point: GeoPoint,
): MorningEvents {
  assertPoint(point);
  const observer = new Observer(
    point.latitude,
    point.longitude,
    point.elevationMeters ?? 0,
  );
  const start = beijingDateStartUtc(beijingDateIso);
  const searchDays = 1;

  return {
    astronomicalDawn: toDate(
      SearchAltitude(Body.Sun, observer, +1, start, searchDays, -18),
    ),
    nauticalDawn: toDate(
      SearchAltitude(Body.Sun, observer, +1, start, searchDays, -12),
    ),
    civilDawn: toDate(
      SearchAltitude(Body.Sun, observer, +1, start, searchDays, -6),
    ),
    sunrise: toDate(SearchRiseSet(Body.Sun, observer, +1, start, searchDays)),
    sunset: toDate(SearchRiseSet(Body.Sun, observer, -1, start, searchDays)),
  };
}

export function getSeasonInstants(year: number): SeasonInstants {
  if (!Number.isInteger(year)) {
    throw new TypeError("Year must be an integer.");
  }
  const seasons = Seasons(year);
  return {
    marchEquinox: seasons.mar_equinox.date,
    juneSolstice: seasons.jun_solstice.date,
    septemberEquinox: seasons.sep_equinox.date,
    decemberSolstice: seasons.dec_solstice.date,
  };
}
