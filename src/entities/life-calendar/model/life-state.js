import { clamp } from "../../../shared/lib/math/index.js";
import {
  daysInMonth,
  makeLocalTime,
  addDays,
  diffDays,
} from "../../../shared/lib/date/index.js";

export const yearTimestamps = new Float64Array(101);
export const monthTimestamps = new Float64Array(1201);

export const canvasToColMap = new WeakMap();
export const decadeColumns = [];

export const invalidateBoardRects = () =>
  decadeColumns.forEach((col) => (col.rect = null));

export const lifeState = {
  birth: null,              // { y, m, d } | null
  startMs: 0,               // timestamp of birth
  endMs: 0,                 // timestamp of 100th birthday
  totalDays: 0,             // total days in 100 years
  totalWeeks: 0,            // total weeks across 10 decades
  showBirthdays: false,     // highlight birthdays in days view
  gender: null,             // 'm' | 'f' | null
  scale: "days",            // active unit of time
  activeBoardCell: null,    // { col, idx, source } | null
  emptyFlipCleanup: null,   // FLIP transition cleanup callback
  expectancyAnimStart: -1e9,// performance.now() timestamp
  expectancyAnimRaf: 0,     // requestAnimationFrame ID
};

export const findIntervalIndex = (arr, baseOffset, maxIdx, targetMs, approxIdx) => {
  let idx = clamp(approxIdx | 0, 0, maxIdx);
  while (idx < maxIdx && targetMs >= arr[baseOffset + idx + 1]) idx++;
  while (idx > 0 && targetMs < arr[baseOffset + idx]) idx--;
  return idx;
};

export const getIntervalFraction = (arr, idx, targetMs) =>
  clamp((targetMs - arr[idx]) / Math.max(1, arr[idx + 1] - arr[idx]), 0, 1);

export const getDayStepProgress = (startMs, endMs, totalUnits, stepDays, targetMs) => {
  const unitIdx = Math.min(
    totalUnits - 1,
    (Math.max(0, diffDays(startMs, targetMs)) / stepDays) | 0
  );
  const unitStart = addDays(startMs, unitIdx * stepDays);
  const unitEnd = unitIdx === totalUnits - 1 ? endMs : addDays(startMs, (unitIdx + 1) * stepDays);
  return unitIdx + clamp((targetMs - unitStart) / Math.max(1, unitEnd - unitStart), 0, 1);
};

export const getAgeIndexAt = (targetMs) =>
  !lifeState.birth || targetMs <= lifeState.startMs
    ? 0
    : targetMs >= lifeState.endMs
    ? 99
    : findIntervalIndex(
        yearTimestamps,
        0,
        99,
        targetMs,
        (targetMs - lifeState.startMs) / 31556952e3
      );

export function populateLifeTimeline(birthObj) {
  lifeState.birth = birthObj;
  for (let i = 0; i <= 1200; i++) {
    const absMonth = birthObj.m + i;
    const year = birthObj.y + ((absMonth / 12) | 0);
    const month = absMonth % 12;
    const ts = makeLocalTime(year, month, Math.min(birthObj.d, daysInMonth(year, month)));
    monthTimestamps[i] = ts;
    if (i % 12 === 0) {
      yearTimestamps[i / 12] = ts;
    }
  }
  lifeState.startMs = yearTimestamps[0];
  lifeState.endMs = yearTimestamps[100];
  lifeState.totalDays = diffDays(lifeState.startMs, lifeState.endMs);

  let runningWeeks = 0;
  for (let decIdx = 0; decIdx < 10; decIdx++) {
    const start = yearTimestamps[10 * decIdx];
    const end = yearTimestamps[10 * (decIdx + 1)];
    const days = diffDays(start, end);
    const weeks = Math.ceil(days / 7);
    const bdays = new Uint8Array(days);
    for (let y = 0; y < 10; y++) {
      const dayIdx = diffDays(start, yearTimestamps[10 * decIdx + y]);
      if (dayIdx >= 0 && dayIdx < days) {
        bdays[dayIdx] = 1;
      }
    }
    const decData = {
      idx: decIdx,
      start,
      end,
      ms: end - start,
      days,
      bdays,
      weeks,
      weekStart: runningWeeks,
    };
    if (decadeColumns[decIdx]) {
      decadeColumns[decIdx].decade = decData;
    }
    runningWeeks += weeks;
  }
  lifeState.totalWeeks = runningWeeks;
}
