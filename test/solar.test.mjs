import assert from "node:assert/strict";
import test from "node:test";
import * as SunCalc from "suncalc";

import {
  beijingDateStartUtc,
  classifyMorningLight,
  geometricAltitudeFromState,
  getMorningEvents,
  getSeasonInstants,
  getSolarEquatorialState,
  getSolarHorizontalPosition,
} from "../dist/solar.js";

const representativePoints = {
  Mohe: { latitude: 52.97, longitude: 122.54 },
  Beijing: { latitude: 39.9042, longitude: 116.4074 },
  Shanghai: { latitude: 31.2304, longitude: 121.4737 },
  Lhasa: { latitude: 29.652, longitude: 91.1721 },
  Kashgar: { latitude: 39.4704, longitude: 75.9898 },
  Sanya: { latitude: 18.2528, longitude: 109.5119 },
};

function minutesBetween(left, right) {
  return Math.abs(left.valueOf() - right.valueOf()) / 60_000;
}

test("Beijing civil date starts at the matching UTC instant", () => {
  assert.equal(
    beijingDateStartUtc("2026-06-21").toISOString(),
    "2026-06-20T16:00:00.000Z",
  );
  assert.throws(() => beijingDateStartUtc("2026-02-30"), RangeError);
});

test("morning-light boundaries use geometric solar altitude", () => {
  assert.equal(classifyMorningLight(-18.01), "deep-night");
  assert.equal(classifyMorningLight(-18), "astronomical-twilight");
  assert.equal(classifyMorningLight(-12), "nautical-twilight");
  assert.equal(classifyMorningLight(-6), "civil-twilight");
  assert.equal(classifyMorningLight(-0.833), "daylight");
});

test("single-state map formula matches direct engine altitude", () => {
  const instants = [
    new Date("2026-03-20T21:00:00Z"),
    new Date("2026-06-20T21:00:00Z"),
    new Date("2026-09-22T21:00:00Z"),
    new Date("2026-12-21T21:00:00Z"),
  ];

  for (const instant of instants) {
    const state = getSolarEquatorialState(instant);
    for (const [name, point] of Object.entries(representativePoints)) {
      const direct = getSolarHorizontalPosition(instant, point);
      const field = geometricAltitudeFromState(state, point);
      assert.ok(
        Math.abs(direct.geometricAltitudeDeg - field) <= 0.01,
        `${name} differs by more than 0.01 degrees at ${instant.toISOString()}`,
      );
    }
  }
});

test("map-field formula stays within tolerance over a China-wide grid", () => {
  const instants = [
    new Date("2026-03-20T21:00:00Z"),
    new Date("2026-06-20T21:00:00Z"),
    new Date("2026-09-22T21:00:00Z"),
    new Date("2026-12-21T21:00:00Z"),
  ];
  for (const instant of instants) {
    const state = getSolarEquatorialState(instant);
    for (let latitude = 18; latitude <= 54; latitude += 3) {
      for (let longitude = 74; longitude <= 134; longitude += 3) {
        const point = { latitude, longitude };
        const direct = getSolarHorizontalPosition(instant, point);
        const field = geometricAltitudeFromState(state, point);
        assert.ok(Math.abs(direct.geometricAltitudeDeg - field) <= 0.01);
      }
    }
  }
});

test("2026 seasons are returned in chronological order", () => {
  const seasons = getSeasonInstants(2026);
  assert.ok(seasons.marchEquinox < seasons.juneSolstice);
  assert.ok(seasons.juneSolstice < seasons.septemberEquinox);
  assert.ok(seasons.septemberEquinox < seasons.decemberSolstice);
});

test("rise/set times cross-check with independent SunCalc engine", () => {
  const dates = ["2026-03-20", "2026-06-21", "2026-09-23", "2026-12-22"];

  for (const date of dates) {
    for (const [name, point] of Object.entries(representativePoints)) {
      const primary = getMorningEvents(date, point);
      const reference = SunCalc.getTimes(
        new Date(`${date}T12:00:00+08:00`),
        point.latitude,
        point.longitude,
      );

      for (const [label, left, right] of [
        ["sunrise", primary.sunrise, reference.sunrise],
        ["sunset", primary.sunset, reference.sunset],
        ["civil dawn", primary.civilDawn, reference.dawn],
        ["nautical dawn", primary.nauticalDawn, reference.nauticalDawn],
        ["astronomical dawn", primary.astronomicalDawn, reference.nightEnd],
      ]) {
        assert.equal(left === null, right === null, `${name} ${date} ${label} null mismatch`);
        if (left && right) {
          assert.ok(
            minutesBetween(left, right) <= 1,
            `${name} ${date} ${label} differs by more than one minute`,
          );
        }
      }
    }
  }
});

test("morning events are chronological whenever all events occur", () => {
  for (const date of ["2026-03-20", "2026-06-21", "2026-09-23", "2026-12-22"]) {
    for (const point of Object.values(representativePoints)) {
      const events = getMorningEvents(date, point);
      const morning = [
        events.astronomicalDawn,
        events.nauticalDawn,
        events.civilDawn,
        events.sunrise,
      ];
      const available = morning.filter((event) => event !== null);
      for (let index = 1; index < available.length; index += 1) {
        assert.ok(available[index - 1] < available[index]);
      }
      if (events.sunrise && events.sunset) {
        assert.ok(events.sunrise < events.sunset);
      }
    }
  }
});
