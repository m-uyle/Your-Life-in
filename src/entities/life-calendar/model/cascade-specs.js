import { clamp } from "../../../shared/lib/math/index.js";
import {
  scratchDate,
  makeLocalTime,
  addDays,
  diffDays,
  formatDate,
} from "../../../shared/lib/date/index.js";
import {
  yearTimestamps,
  lifeState,
  getIntervalFraction,
  getDayStepProgress,
  getAgeIndexAt,
} from "./life-state.js";

export const formatAgeSpanHtml = (age, unitLabel) =>
  `<span class="lens-sub-label">age</span> <span class="lens-metric-num">${age}</span><span class="lens-metric-arrow">→</span><span class="lens-metric-num">${
    age + 1
  }</span> <span class="lens-sub-label">in ${unitLabel}</span>`;

export const LIFE_CASCADE_SPEC = {
  units: 100,
  range() {
    return {
      start: lifeState.startMs,
      end: lifeState.endMs,
      total: 100,
    };
  },
  getEl(nowMs) {
    if (nowMs >= lifeState.endMs) return 100;
    const clampedMs = Math.max(lifeState.startMs, nowMs);
    const ageIdx = getAgeIndexAt(clampedMs);
    return Math.min(99.999, ageIdx + getIntervalFraction(yearTimestamps, ageIdx, clampedMs));
  },
  cellRange(cellIdx) {
    return {
      start: yearTimestamps[cellIdx],
      end: yearTimestamps[cellIdx + 1],
      label: `Year #${cellIdx + 1} (${lifeState.birth.y + cellIdx}) — age ${cellIdx}`,
    };
  },
};

export const createSubYearCascadeSpec = (unitLabel, stepDays, fixedTotal) => ({
  titleHtml(nowMs) {
    return formatAgeSpanHtml(getAgeIndexAt(nowMs), unitLabel);
  },
  unitLabel,
  units: fixedTotal || 365,
  range(nowMs) {
    const ageIdx = getAgeIndexAt(nowMs);
    const start = yearTimestamps[ageIdx];
    const end = yearTimestamps[ageIdx + 1];
    return {
      start,
      end,
      total: fixedTotal || diffDays(start, end),
      age: ageIdx,
    };
  },
  getEl(nowMs, rangeObj) {
    const total = rangeObj.total || 365;
    return nowMs >= rangeObj.end
      ? total
      : Math.min(
          total - 0.001,
          getDayStepProgress(
            rangeObj.start,
            rangeObj.end,
            total,
            stepDays,
            Math.max(rangeObj.start, nowMs)
          )
        );
  },
  cellRange(cellIdx, rangeObj) {
    const start = addDays(rangeObj.start, cellIdx * stepDays);
    const end =
      fixedTotal && cellIdx === rangeObj.total - 1
        ? rangeObj.end
        : addDays(rangeObj.start, (cellIdx + 1) * stepDays);
    const dateStr =
      stepDays > 1
        ? `${formatDate(start, "dmyShort")} – ${formatDate(addDays(end, -1), "dmyShort")}`
        : formatDate(start, "dmyShort");
    return {
      start,
      end,
      label: `${stepDays > 1 ? "Week" : "Day"} #${cellIdx + 1} of age ${rangeObj.age} (${dateStr})`,
    };
  },
});

export const LENS_SPECS = {
  hours: {
    unit: 36e5,
    cascades: [LIFE_CASCADE_SPEC],
    win(nowMs) {
      const ageIdx = getAgeIndexAt(nowMs);
      const start = yearTimestamps[ageIdx];
      const end = yearTimestamps[ageIdx + 1];
      return {
        start,
        end,
        total: Math.round((end - start) / 36e5),
        age: ageIdx,
      };
    },
    fmt: ["Hour", "hm"],
  },
  minutes: {
    unit: 6e4,
    cascades: [LIFE_CASCADE_SPEC, createSubYearCascadeSpec("weeks", 7, 52)],
    win(nowMs) {
      const clampedMs = clamp(nowMs, lifeState.startMs, lifeState.endMs - 1);
      const ageIdx = getAgeIndexAt(clampedMs);
      const yearStart = yearTimestamps[ageIdx];
      const weekIdx = Math.min(51, (Math.max(0, diffDays(yearStart, clampedMs)) / 7) | 0);
      const start = addDays(yearStart, 7 * weekIdx);
      const end = weekIdx === 51 ? yearTimestamps[ageIdx + 1] : addDays(start, 7);
      return {
        start,
        end,
        total: Math.round((end - start) / 6e4),
        weekInYear: weekIdx + 1,
      };
    },
    fmt: ["Minute", "hm"],
  },
  seconds: {
    unit: 1e3,
    cascades: [LIFE_CASCADE_SPEC, createSubYearCascadeSpec("days", 1, 0)],
    win(nowMs) {
      scratchDate.setTime(clamp(nowMs, lifeState.startMs, lifeState.endMs - 1));
      const start = makeLocalTime(
        scratchDate.getFullYear(),
        scratchDate.getMonth(),
        scratchDate.getDate()
      );
      const end = addDays(start, 1);
      return {
        start,
        end,
        total: Math.round((end - start) / 1e3),
      };
    },
    fmt: ["Second", "hms"],
  },
};

export const getBoardUnit = () =>
  LENS_SPECS[lifeState.scale] ? "days" : lifeState.scale;
