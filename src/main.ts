import chinaMap from "@svg-maps/china";

import {
  BEIJING_TIME_ZONE,
  classifyMorningLight,
  geometricAltitudeFromState,
  getMorningEvents,
  getSolarEquatorialState,
  getSolarHorizontalPosition,
  type GeoPoint,
  type MorningLightStage,
} from "./domain/solar.js";
import { representativePlaces, type Place } from "./data/places.js";

type SeasonKey = "spring" | "summer" | "autumn" | "winter";
type Slot = "primary" | "compare";

const seasonPresets: Record<SeasonKey, { label: string; shortLabel: string; dateIso: string }> = {
  spring: { label: "春分", shortLabel: "春", dateIso: "2026-03-20" },
  summer: { label: "夏至", shortLabel: "夏", dateIso: "2026-06-21" },
  autumn: { label: "秋分", shortLabel: "秋", dateIso: "2026-09-23" },
  winter: { label: "冬至", shortLabel: "冬", dateIso: "2026-12-22" },
};

const state = {
  season: "summer" as SeasonKey,
  minutes: 300,
  playing: false,
  activeSlot: "primary" as Slot,
  primaryPlaceId: "beijing",
  comparePlaceId: "urumqi",
};

const appRoot = document.querySelector<HTMLElement>("#app");

if (!appRoot) {
  throw new Error("App root not found.");
}

const app: HTMLElement = appRoot;
const placeById = new Map(representativePlaces.map((place) => [place.id, place]));

const mapBounds = {
  minLon: 73,
  maxLon: 135,
  minLat: 18,
  maxLat: 54,
};

const viewBox = parseViewBox(chinaMap.viewBox);

const stageStyles: Record<
  MorningLightStage,
  { label: string; range: string; color: string; textColor: string }
> = {
  "deep-night": {
    label: "深夜",
    range: "< -18°",
    color: "#172133",
    textColor: "#d8e2ed",
  },
  "astronomical-twilight": {
    label: "天文曙光",
    range: "-18° 至 -12°",
    color: "#243b66",
    textColor: "#d7e4ff",
  },
  "nautical-twilight": {
    label: "航海曙光",
    range: "-12° 至 -6°",
    color: "#426987",
    textColor: "#dff5ff",
  },
  "civil-twilight": {
    label: "民用曙光",
    range: "-6° 至 0°",
    color: "#b98663",
    textColor: "#fff0df",
  },
  daylight: {
    label: "日出后白昼",
    range: "> 0°",
    color: "#e1bf78",
    textColor: "#fff7df",
  },
};

const beijingClock = new Intl.DateTimeFormat("zh-CN", {
  timeZone: BEIJING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const clockOnly = new Intl.DateTimeFormat("zh-CN", {
  timeZone: BEIJING_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

let playbackHandle: number | null = null;

render();

function render(): void {
  const season = seasonPresets[state.season];
  const instant = buildBeijingInstant(season.dateIso, state.minutes);
  const primary = getCurrentPlace("primary");
  const compare = getCurrentPlace("compare");
  const selectedPrimary = snapshotFor(primary, season.dateIso, instant);
  const selectedCompare = snapshotFor(compare, season.dateIso, instant);
  const summary = buildSampleSummary(season.dateIso);

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <p class="eyebrow">数字 / 动态地图设计赛道</p>
          <h1>晨光中国</h1>
          <p>同一北京时间下的中国黎明时空动态地图</p>
        </div>
        <div class="time-dashboard" aria-label="当前时空状态">
          <div>
            <span>节气</span>
            <strong>${season.label}</strong>
          </div>
          <div>
            <span>北京时间</span>
            <strong>${formatBeijingDateTime(instant)}</strong>
          </div>
          <div>
            <span>样本日出跨度</span>
            <strong>${summary.spreadText}</strong>
          </div>
        </div>
      </header>

      <main class="workspace">
        <section class="map-panel" aria-label="全国晨光地图">
          <div class="map-stage">
            <div class="map-annotation">
              <span>全国太阳高度场</span>
              <strong>${stageStyles[selectedPrimary.stage].label}</strong>
            </div>
            ${renderMap(instant)}
          </div>
          <div class="map-footer">
            <div class="footer-item">
              <span class="footer-kicker">最早日出</span>
              <strong>${summary.earliestText}</strong>
            </div>
            <div class="footer-item">
              <span class="footer-kicker">最晚日出</span>
              <strong>${summary.latestText}</strong>
            </div>
            <div class="footer-item footer-item--wide">
              <span class="footer-kicker">当前观察</span>
              <strong>${selectedPrimary.name} 与 ${selectedCompare.name} 的理论日出相差 ${formatAbsDelta(
                minuteDelta(selectedPrimary.events.sunrise, selectedCompare.events.sunrise),
              )}</strong>
            </div>
          </div>
        </section>

        <aside class="inspector" aria-label="地图控制与地点读数">
          <section class="control-panel">
            <div class="panel-heading">
              <span>时间控制</span>
              <strong>${formatMinutes(state.minutes)}</strong>
            </div>
            <div class="season-row" role="tablist" aria-label="节气切换">
              ${renderSeasonButtons()}
            </div>
            <label class="time-row">
              <span>北京时间轴</span>
              <input
                id="time-slider"
                class="time-slider"
                type="range"
                min="180"
                max="600"
                step="1"
                value="${state.minutes}"
                aria-label="北京时间轴"
              />
            </label>
            <div class="time-scale">
              <span>03:00</span>
              <span>06:00</span>
              <span>10:00</span>
            </div>
            <div class="toolbar">
              <button id="play-toggle" class="action-button" type="button">
                ${state.playing ? "暂停" : "播放"}
              </button>
              <button id="slot-toggle" class="action-button action-button--secondary" type="button">
                点击写入：${state.activeSlot === "primary" ? "主地点" : "对比地点"}
              </button>
            </div>
          </section>

          <section class="control-panel">
            <div class="panel-heading">
              <span>地点比较</span>
              <strong>${selectedPrimary.name} / ${selectedCompare.name}</strong>
            </div>
            <div class="select-grid">
              <label class="field">
                <span>主地点</span>
                <select id="primary-select">
                  ${renderPlaceOptions(state.primaryPlaceId)}
                </select>
              </label>
              <label class="field">
                <span>对比地点</span>
                <select id="compare-select">
                  ${renderPlaceOptions(state.comparePlaceId)}
                </select>
              </label>
            </div>
            <div class="place-cards">
              ${renderSnapshotCard(selectedPrimary, "primary")}
              ${renderSnapshotCard(selectedCompare, "compare")}
            </div>
            ${renderComparisonStrip(selectedPrimary, selectedCompare)}
          </section>

          <section class="control-panel control-panel--legend">
            <div class="panel-heading">
              <span>晨光阶段</span>
              <strong>太阳高度角</strong>
            </div>
            <div class="legend">
              ${Object.entries(stageStyles)
                .map(
                  ([stageKey, style]) => `
                    <div class="legend-row">
                      <span class="legend-swatch" style="background:${style.color}"></span>
                      <span>${style.label}</span>
                      <span>${style.range}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
            <p class="model-note">
              当前为理论天文日出模型：北京时间、WGS84 坐标、太阳中心高度约 -0.833°。正式参赛版需替换为自然资源主管部门标准地图并保留审图号。
            </p>
          </section>
        </aside>
      </main>
    </div>
  `;

  bindInteractions();
}

function renderMap(instant: Date): string {
  const fieldState = getSolarEquatorialState(instant);
  const grid = renderFieldGrid(fieldState);
  const maskPaths = chinaMap.locations
    .map((location) => `<path d="${location.path}" fill="#fff"></path>`)
    .join("");
  const provinceOutlines = chinaMap.locations
    .map(
      (location) => `
        <path
          d="${location.path}"
          class="province-outline"
          data-province="${location.id}"
        ></path>
      `,
    )
    .join("");

  return `
    <svg
      class="china-svg"
      viewBox="${chinaMap.viewBox}"
      role="img"
      aria-label="中国晨光动态地图"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <mask id="china-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${viewBox.width}" height="${viewBox.height}">
          <rect x="0" y="0" width="${viewBox.width}" height="${viewBox.height}" fill="#000"></rect>
          <g fill="#fff">
            ${maskPaths}
          </g>
        </mask>
        <radialGradient id="ocean-glow" cx="74%" cy="30%" r="76%">
          <stop offset="0%" stop-color="#30434a"></stop>
          <stop offset="48%" stop-color="#17262b"></stop>
          <stop offset="100%" stop-color="#0c171a"></stop>
        </radialGradient>
        <linearGradient id="terrain-wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.16)"></stop>
          <stop offset="54%" stop-color="rgba(255,255,255,0.04)"></stop>
          <stop offset="100%" stop-color="rgba(0,0,0,0.16)"></stop>
        </linearGradient>
        <filter id="soft-shadow" x="-12%" y="-12%" width="124%" height="124%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#020608" flood-opacity="0.38"></feDropShadow>
        </filter>
      </defs>

      <rect class="canvas-bg" x="0" y="0" width="${viewBox.width}" height="${viewBox.height}"></rect>
      ${renderGraticule()}
      <g class="china-land" mask="url(#china-mask)" filter="url(#soft-shadow)">
        <rect x="0" y="0" width="${viewBox.width}" height="${viewBox.height}" class="land-base"></rect>
        ${renderReliefTexture()}
        ${grid}
        <rect x="0" y="0" width="${viewBox.width}" height="${viewBox.height}" class="terrain-wash"></rect>
      </g>
      <g class="boundary-layer">
        ${provinceOutlines}
      </g>
      ${renderPlaceMarkers(instant)}
      ${renderSouthChinaSeaInset()}
    </svg>
  `;
}

function renderFieldGrid(solarState: ReturnType<typeof getSolarEquatorialState>): string {
  const columns = 96;
  const rows = 68;
  const cellWidth = viewBox.width / columns;
  const cellHeight = viewBox.height / rows;
  let output = "";

  for (let row = 0; row < rows; row += 1) {
    const latitude =
      mapBounds.maxLat - ((row + 0.5) / rows) * (mapBounds.maxLat - mapBounds.minLat);
    for (let column = 0; column < columns; column += 1) {
      const longitude =
        mapBounds.minLon + ((column + 0.5) / columns) * (mapBounds.maxLon - mapBounds.minLon);
      const altitude = geometricAltitudeFromState(solarState, { latitude, longitude });
      const stage = classifyMorningLight(altitude);
      output += `
        <rect
          x="${(column * cellWidth).toFixed(2)}"
          y="${(row * cellHeight).toFixed(2)}"
          width="${(cellWidth + 0.35).toFixed(2)}"
          height="${(cellHeight + 0.35).toFixed(2)}"
          fill="${colorForAltitude(altitude)}"
          data-stage="${stage}"
        ></rect>
      `;
    }
  }

  return `<g class="light-field">${output}</g>`;
}

function renderGraticule(): string {
  const longitudes = [80, 90, 100, 110, 120, 130];
  const latitudes = [20, 30, 40, 50];
  const lonLines = longitudes
    .map((longitude) => {
      const top = project({ latitude: mapBounds.maxLat, longitude });
      const bottom = project({ latitude: mapBounds.minLat, longitude });
      return `<line x1="${top.x}" y1="${top.y}" x2="${bottom.x}" y2="${bottom.y}"></line>`;
    })
    .join("");
  const latLines = latitudes
    .map((latitude) => {
      const left = project({ latitude, longitude: mapBounds.minLon });
      const right = project({ latitude, longitude: mapBounds.maxLon });
      return `<line x1="${left.x}" y1="${left.y}" x2="${right.x}" y2="${right.y}"></line>`;
    })
    .join("");

  return `<g class="graticule">${lonLines}${latLines}</g>`;
}

function renderReliefTexture(): string {
  return `
    <g class="relief-layer" aria-hidden="true">
      <path d="M58 370 C132 312 192 292 272 320 C332 342 402 328 492 286" class="relief-band relief-band--plateau"></path>
      <path d="M120 214 C184 178 248 184 322 198 C384 210 448 186 518 172" class="relief-line"></path>
      <path d="M404 132 C470 104 538 112 614 134 C672 150 720 142 758 124" class="relief-line relief-line--light"></path>
      <path d="M376 398 C446 374 516 376 600 406 C650 424 696 420 742 396" class="relief-line relief-line--light"></path>
      <path d="M480 252 C540 236 600 242 662 266 C702 282 736 280 766 260" class="river-line"></path>
      <path d="M338 314 C414 300 494 306 584 336 C648 358 700 350 750 326" class="river-line river-line--main"></path>
    </g>
  `;
}

function renderPlaceMarkers(instant: Date): string {
  const markers = representativePlaces
    .map((place) => {
      const point = project(place);
      const stage = classifyMorningLight(
        getSolarHorizontalPosition(instant, place).geometricAltitudeDeg,
      );
      const isPrimary = place.id === state.primaryPlaceId;
      const isCompare = place.id === state.comparePlaceId;
      const markerClass = [
        "marker",
        isPrimary ? "marker--primary" : "",
        isCompare ? "marker--compare" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const label = isPrimary || isCompare ? `<text x="8" y="-7">${place.name}</text>` : "";
      return `
        <g
          class="${markerClass}"
          data-place-id="${place.id}"
          transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})"
        >
          <title>${place.name}：${stageStyles[stage].label}</title>
          <circle class="marker-hit" r="10"></circle>
          <circle class="marker-core" r="${isPrimary || isCompare ? 3.8 : 2.4}"></circle>
          ${label}
        </g>
      `;
    })
    .join("");

  return `<g class="marker-layer">${markers}</g>`;
}

function renderSouthChinaSeaInset(): string {
  return `
    <g class="south-sea-inset" aria-label="南海诸岛示意">
      <rect x="614" y="390" width="132" height="150" rx="4"></rect>
      <path d="M638 414 C678 424 708 450 726 492" class="inset-dash"></path>
      <path d="M642 510 C674 492 700 494 730 520" class="inset-dash"></path>
      <circle cx="666" cy="442" r="2.1"></circle>
      <circle cx="696" cy="468" r="1.8"></circle>
      <circle cx="681" cy="500" r="1.7"></circle>
      <circle cx="718" cy="516" r="1.8"></circle>
      <text x="628" y="528">南海诸岛</text>
    </g>
  `;
}

function renderSeasonButtons(): string {
  return Object.entries(seasonPresets)
    .map(
      ([key, season]) => `
        <button
          class="season-button ${state.season === key ? "season-button--active" : ""}"
          type="button"
          data-season="${key}"
          aria-pressed="${state.season === key}"
        >
          <span>${season.shortLabel}</span>${season.label}
        </button>
      `,
    )
    .join("");
}

function renderPlaceOptions(selectedId: string): string {
  return representativePlaces
    .map(
      (place) => `
        <option value="${place.id}" ${place.id === selectedId ? "selected" : ""}>
          ${place.name} / ${place.region}
        </option>
      `,
    )
    .join("");
}

function renderSnapshotCard(snapshot: Snapshot, role: Slot): string {
  const sunrise = snapshot.events.sunrise ? clockOnly.format(snapshot.events.sunrise) : "无";
  const dawn = snapshot.events.civilDawn ? clockOnly.format(snapshot.events.civilDawn) : "无";
  const accent = role === "primary" ? "主" : "对";

  return `
    <article class="place-card place-card--${role}">
      <div class="place-card-top">
        <span>${accent}</span>
        <strong>${snapshot.name}</strong>
      </div>
      <div class="stage-line" style="--stage-color:${stageStyles[snapshot.stage].color}">
        ${stageStyles[snapshot.stage].label}
      </div>
      <dl>
        <div><dt>理论日出</dt><dd>${sunrise}</dd></div>
        <div><dt>民用曙光</dt><dd>${dawn}</dd></div>
        <div><dt>太阳高度</dt><dd>${formatDegrees(snapshot.horizontal.geometricAltitudeDeg)}</dd></div>
        <div><dt>地方太阳时</dt><dd>${formatSolarTime(snapshot)}</dd></div>
      </dl>
    </article>
  `;
}

function renderComparisonStrip(primary: Snapshot, compare: Snapshot): string {
  const sunriseDelta = minuteDelta(primary.events.sunrise, compare.events.sunrise);
  const altitudeDelta =
    compare.horizontal.geometricAltitudeDeg - primary.horizontal.geometricAltitudeDeg;
  return `
    <div class="comparison-strip">
      <div>
        <span>日出差</span>
        <strong>${formatSignedMinutes(sunriseDelta)}</strong>
      </div>
      <div>
        <span>当前太阳高度差</span>
        <strong>${formatDegrees(altitudeDelta)}</strong>
      </div>
    </div>
  `;
}

function buildSampleSummary(dateIso: string): {
  earliestText: string;
  latestText: string;
  spreadText: string;
} {
  const sunrises = representativePlaces
    .map((place) => {
      const sunrise = getMorningEvents(dateIso, place).sunrise;
      return sunrise ? { place, sunrise } : null;
    })
    .filter((item): item is { place: Place; sunrise: Date } => item !== null)
    .sort((left, right) => left.sunrise.valueOf() - right.sunrise.valueOf());

  const earliest = sunrises[0];
  const latest = sunrises.at(-1);
  if (!earliest || !latest) {
    return {
      earliestText: "无",
      latestText: "无",
      spreadText: "无",
    };
  }

  return {
    earliestText: `${earliest.place.name} ${clockOnly.format(earliest.sunrise)}`,
    latestText: `${latest.place.name} ${clockOnly.format(latest.sunrise)}`,
    spreadText: formatDuration(latest.sunrise.valueOf() - earliest.sunrise.valueOf()),
  };
}

function snapshotFor(place: Place, dateIso: string, instant: Date): Snapshot {
  const horizontal = getSolarHorizontalPosition(instant, place);
  const events = getMorningEvents(dateIso, place);
  const stage = classifyMorningLight(horizontal.geometricAltitudeDeg);

  return {
    ...place,
    point: place,
    instant,
    horizontal,
    events,
    stage,
  };
}

interface Snapshot extends Place {
  point: GeoPoint;
  instant: Date;
  horizontal: ReturnType<typeof getSolarHorizontalPosition>;
  events: ReturnType<typeof getMorningEvents>;
  stage: MorningLightStage;
}

function bindInteractions(): void {
  const seasonButtons = document.querySelectorAll<HTMLButtonElement>("[data-season]");
  seasonButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const season = button.dataset.season as SeasonKey | undefined;
      if (season) {
        state.season = season;
        render();
      }
    });
  });

  const slider = document.querySelector<HTMLInputElement>("#time-slider");
  slider?.addEventListener("input", () => {
    state.minutes = Number(slider.value);
    render();
  });

  const playButton = document.querySelector<HTMLButtonElement>("#play-toggle");
  playButton?.addEventListener("click", () => {
    state.playing = !state.playing;
    if (state.playing) {
      startPlayback();
    } else {
      stopPlayback();
    }
    render();
  });

  const slotButton = document.querySelector<HTMLButtonElement>("#slot-toggle");
  slotButton?.addEventListener("click", () => {
    state.activeSlot = state.activeSlot === "primary" ? "compare" : "primary";
    render();
  });

  const primarySelect = document.querySelector<HTMLSelectElement>("#primary-select");
  primarySelect?.addEventListener("change", () => {
    state.primaryPlaceId = primarySelect.value;
    render();
  });

  const compareSelect = document.querySelector<HTMLSelectElement>("#compare-select");
  compareSelect?.addEventListener("change", () => {
    state.comparePlaceId = compareSelect.value;
    render();
  });

  const svg = document.querySelector<SVGSVGElement>(".china-svg");
  svg?.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    const marker = target?.closest("[data-place-id]") as SVGGElement | null;
    if (marker?.dataset.placeId) {
      setActivePlace(marker.dataset.placeId);
      return;
    }

    const point = svgPoint(svg, event);
    const nearest = findNearestPlace(point.x, point.y);
    setActivePlace(nearest.id);
  });
}

function setActivePlace(placeId: string): void {
  if (state.activeSlot === "primary") {
    state.primaryPlaceId = placeId;
  } else {
    state.comparePlaceId = placeId;
  }
  render();
}

function startPlayback(): void {
  if (playbackHandle !== null) {
    return;
  }
  playbackHandle = window.setInterval(() => {
    state.minutes += 1.5;
    if (state.minutes > 600) {
      state.minutes = 180;
    }
    render();
  }, 110);
}

function stopPlayback(): void {
  if (playbackHandle !== null) {
    window.clearInterval(playbackHandle);
    playbackHandle = null;
  }
}

function getCurrentPlace(slot: Slot): Place {
  const placeId = slot === "primary" ? state.primaryPlaceId : state.comparePlaceId;
  return placeById.get(placeId) ?? representativePlaces[0]!;
}

function findNearestPlace(x: number, y: number): Place {
  let candidate = representativePlaces[0]!;
  let distance = Number.POSITIVE_INFINITY;
  for (const place of representativePlaces) {
    const projected = project(place);
    const deltaX = projected.x - x;
    const deltaY = projected.y - y;
    const currentDistance = deltaX * deltaX + deltaY * deltaY;
    if (currentDistance < distance) {
      candidate = place;
      distance = currentDistance;
    }
  }
  return candidate;
}

function project(point: GeoPoint): { x: number; y: number } {
  return {
    x:
      ((point.longitude - mapBounds.minLon) /
        (mapBounds.maxLon - mapBounds.minLon)) *
      viewBox.width,
    y:
      ((mapBounds.maxLat - point.latitude) /
        (mapBounds.maxLat - mapBounds.minLat)) *
      viewBox.height,
  };
}

function svgPoint(svg: SVGSVGElement, event: MouseEvent): { x: number; y: number } {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const screenMatrix = svg.getScreenCTM();
  if (!screenMatrix) {
    return { x: 0, y: 0 };
  }
  const transformed = point.matrixTransform(screenMatrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function parseViewBox(viewBoxText: string): { width: number; height: number } {
  const parts = viewBoxText.split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid SVG viewBox: ${viewBoxText}`);
  }
  const width = parts[2]!;
  const height = parts[3]!;
  return { width, height };
}

function buildBeijingInstant(dateIso: string, minutes: number): Date {
  const clamped = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const hours = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mins = String(clamped % 60).padStart(2, "0");
  return new Date(`${dateIso}T${hours}:${mins}:00+08:00`);
}

function formatBeijingDateTime(instant: Date): string {
  return beijingClock.format(instant).replaceAll("/", "-");
}

function formatMinutes(minutes: number): string {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatDegrees(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}°`;
}

function formatSolarTime(snapshot: Snapshot): string {
  const offsetMinutes = (snapshot.longitude - 120) * 4;
  return formatMinutes(state.minutes + offsetMinutes);
}

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.abs(Math.round(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}小时${minutes}分钟`;
}

function formatSignedMinutes(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "无";
  }
  const totalMinutes = Math.round(milliseconds / 60_000);
  const sign = totalMinutes > 0 ? "+" : "";
  return `${sign}${totalMinutes} 分钟`;
}

function formatAbsDelta(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "无";
  }
  return formatDuration(milliseconds);
}

function minuteDelta(left: Date | null, right: Date | null): number | null {
  if (!left || !right) {
    return null;
  }
  return left.valueOf() - right.valueOf();
}

function colorForAltitude(altitude: number): string {
  if (altitude <= -18) return "#172133";
  if (altitude < -12) return mixHex("#172133", "#243b66", (altitude + 18) / 6);
  if (altitude < -6) return mixHex("#243b66", "#426987", (altitude + 12) / 6);
  if (altitude < 0) return mixHex("#426987", "#b98663", (altitude + 6) / 6);
  if (altitude < 10) return mixHex("#c99a65", "#e1bf78", altitude / 10);
  return "#e1bf78";
}

function mixHex(from: string, to: string, amount: number): string {
  const ratio = Math.max(0, Math.min(1, amount));
  const left = hexToRgb(from);
  const right = hexToRgb(to);
  const mixed = left.map((value, index) =>
    Math.round(value + (right[index]! - value) * ratio),
  );
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}
