import * as SunCalc from "suncalc";

import {
  geometricAltitudeFromState,
  getMorningEvents,
  getSeasonInstants,
  getSolarEquatorialState,
  getSolarHorizontalPosition,
} from "../dist/solar.js";

const points = {
  "漠河": { latitude: 52.97, longitude: 122.54 },
  "北京": { latitude: 39.9042, longitude: 116.4074 },
  "上海": { latitude: 31.2304, longitude: 121.4737 },
  "拉萨": { latitude: 29.652, longitude: 91.1721 },
  "喀什": { latitude: 39.4704, longitude: 75.9898 },
  "三亚": { latitude: 18.2528, longitude: 109.5119 },
};

const dates = ["2026-03-20", "2026-06-21", "2026-09-23", "2026-12-22"];
const fieldInstants = [
  new Date("2026-03-20T21:00:00Z"),
  new Date("2026-06-20T21:00:00Z"),
  new Date("2026-09-22T21:00:00Z"),
  new Date("2026-12-21T21:00:00Z"),
];

let maxFieldDifference = { degrees: -1 };
for (const instant of fieldInstants) {
  const state = getSolarEquatorialState(instant);
  for (const [place, point] of Object.entries(points)) {
    const direct = getSolarHorizontalPosition(instant, point).geometricAltitudeDeg;
    const field = geometricAltitudeFromState(state, point);
    const degrees = Math.abs(direct - field);
    if (degrees > maxFieldDifference.degrees) {
      maxFieldDifference = { degrees, place, instant: instant.toISOString(), direct, field };
    }
  }
}

const eventMapping = [
  ["理论日出", "sunrise", "sunrise"],
  ["理论日落", "sunset", "sunset"],
  ["民用曙光", "civilDawn", "dawn"],
  ["航海曙光", "nauticalDawn", "nauticalDawn"],
  ["天文曙光", "astronomicalDawn", "nightEnd"],
];

let maxEventDifference = { seconds: -1 };
let comparedEvents = 0;
let matchingNullEvents = 0;
for (const date of dates) {
  for (const [place, point] of Object.entries(points)) {
    const primary = getMorningEvents(date, point);
    const reference = SunCalc.getTimes(
      new Date(`${date}T12:00:00+08:00`),
      point.latitude,
      point.longitude,
    );
    for (const [event, primaryKey, referenceKey] of eventMapping) {
      const left = primary[primaryKey];
      const right = reference[referenceKey];
      if (left === null || right === null) {
        if (left === null && right === null) matchingNullEvents += 1;
        continue;
      }
      comparedEvents += 1;
      const seconds = Math.abs(left.valueOf() - right.valueOf()) / 1000;
      if (seconds > maxEventDifference.seconds) {
        maxEventDifference = {
          seconds,
          place,
          date,
          event,
          primary: left.toISOString(),
          reference: right.toISOString(),
        };
      }
    }
  }
}

const seasons = getSeasonInstants(2026);
console.log(JSON.stringify({
  seasons,
  samplePointCount: Object.keys(points).length,
  sampleDateCount: dates.length,
  comparedEvents,
  matchingNullEvents,
  maxFieldDifference,
  maxEventDifference,
}, null, 2));
