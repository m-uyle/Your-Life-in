import { TICKER_DECIMALS } from "../../../shared/config/index.js";
import { domRefs } from "../../../shared/lib/dom/index.js";
import { clamp } from "../../../shared/lib/math/index.js";
import { numberFormatter } from "../../../shared/lib/date/index.js";
import {
  yearTimestamps,
  monthTimestamps,
  decadeColumns,
  lifeState,
  findIntervalIndex,
  getIntervalFraction,
  getDayStepProgress,
  getAgeIndexAt,
  LENS_SPECS,
} from "../../../entities/life-calendar/index.js";

let lastIntVal = -1;
let lastTotalVal = -1;
let lastPctIntStr = "";
let lastUnit = "";

export function resetTickerCache() {
  lastIntVal = lastTotalVal = -1;
  lastPctIntStr = lastUnit = "";
}

export function syncMonospaceDigits(parentEl, text) {
  let spans = parentEl.children;
  while (spans.length < text.length) {
    parentEl.appendChild(document.createElement("span"));
  }
  while (spans.length > text.length) {
    parentEl.removeChild(parentEl.lastChild);
  }
  for (let idx = 0; idx < text.length; idx++) {
    const span = spans[idx];
    const ch = text[idx];
    if (span.textContent !== ch) {
      const cls = ch >= "0" && ch <= "9" ? "t-char-d" : "";
      if (span.className !== cls) {
        span.className = cls;
      }
      span.textContent = ch;
    }
  }
}

export function updateTicker(nowMs) {
  const summaryEl = domRefs.summaryInfo;
  summaryEl.style.visibility = lifeState.birth ? "" : "hidden";
  if (!lifeState.birth) return;

  const scale = lifeState.scale;
  if (lastUnit !== scale) {
    domRefs.tUnit.textContent = scale;
    lastUnit = scale;
    domRefs.tInt.textContent = "";
    lastIntVal = lastTotalVal = -1;
  }

  const totalLifeMs = Math.max(1, lifeState.endMs - lifeState.startMs);
  const livedMs = clamp(nowMs - lifeState.startMs, 0, totalLifeMs);
  const clampedNow = lifeState.startMs + livedMs;
  const ageIdx = getAgeIndexAt(clampedNow);
  const yearsLived =
    nowMs >= lifeState.endMs
      ? 100
      : Math.min(100, ageIdx + getIntervalFraction(yearTimestamps, ageIdx, clampedNow));

  let livedUnits = 0;
  let totalUnits = 100;

  if (scale === "years") {
    livedUnits = yearsLived;
  } else if (scale === "months") {
    totalUnits = 1200;
    if (nowMs >= lifeState.endMs) {
      livedUnits = 1200;
    } else {
      const mIdx = findIntervalIndex(monthTimestamps, 0, 1199, clampedNow, 12 * ageIdx);
      livedUnits = mIdx + getIntervalFraction(monthTimestamps, mIdx, clampedNow);
    }
  } else if (scale === "days") {
    totalUnits = lifeState.totalDays;
    livedUnits =
      nowMs >= lifeState.endMs
        ? lifeState.totalDays
        : getDayStepProgress(
            lifeState.startMs,
            lifeState.endMs,
            lifeState.totalDays,
            1,
            clampedNow
          );
  } else if (scale === "weeks") {
    totalUnits = lifeState.totalWeeks;
    if (nowMs >= lifeState.endMs) {
      livedUnits = lifeState.totalWeeks;
    } else {
      const dec = decadeColumns[Math.min(9, (ageIdx / 10) | 0)]?.decade;
      livedUnits = dec
        ? dec.weekStart + getDayStepProgress(dec.start, dec.end, dec.weeks, 7, clampedNow)
        : (livedMs / totalLifeMs) * lifeState.totalWeeks;
    }
  } else {
    const unitMs = LENS_SPECS[scale].unit;
    livedUnits = livedMs / unitMs;
    totalUnits = totalLifeMs / unitMs;
  }

  const decimals = TICKER_DECIMALS[scale];
  let intPart = 0;
  let fracStr = "";
  if (decimals > 0) {
    const fixedStr = livedUnits.toFixed(decimals);
    const dotIdx = fixedStr.indexOf(".");
    intPart = Number(fixedStr.slice(0, dotIdx));
    fracStr = fixedStr.slice(dotIdx);
  } else {
    intPart = Math.round(livedUnits);
  }

  if (intPart !== lastIntVal) {
    lastIntVal = intPart;
    const formattedInt = numberFormatter.format(intPart);
    if (scale === "seconds") {
      syncMonospaceDigits(domRefs.tInt, formattedInt);
    } else {
      domRefs.tInt.textContent = formattedInt;
    }
  }
  syncMonospaceDigits(domRefs.tFrac, fracStr);

  const roundedTotal = Math.round(totalUnits);
  if (roundedTotal !== lastTotalVal) {
    lastTotalVal = roundedTotal;
    domRefs.tTotal.textContent = numberFormatter.format(roundedTotal);
  }

  const pct = Math.min(100, (livedMs / totalLifeMs) * 100);
  const pctFixed = pct.toFixed(8);
  const pctDotIdx = pctFixed.indexOf(".");
  const pctIntStr = pctFixed.slice(0, pctDotIdx);
  if (pctIntStr !== lastPctIntStr) {
    domRefs.tPctInt.textContent = lastPctIntStr = pctIntStr;
  }
  syncMonospaceDigits(domRefs.tPctFrac, pctFixed.slice(pctDotIdx));
}

export function initTickerFontCalibration() {
  const calibrate = () => {
    const probe = document.createElement("div");
    probe.className = "ticker-int";
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;";
    const digitSpans = Array.from({ length: 10 }, (_, digit) => {
      const span = document.createElement("span");
      span.textContent = String(digit);
      probe.appendChild(span);
      return span;
    });
    domRefs.tInt.parentElement.appendChild(probe);
    const fontSize = parseFloat(getComputedStyle(probe).fontSize) || 16;
    const maxDigitW = Math.max(...digitSpans.map((s) => s.getBoundingClientRect().width));
    probe.remove();
    if (maxDigitW > 0) {
      domRefs.summaryInfo.style.setProperty(
        "--digit-w",
        `${((maxDigitW / fontSize) * 0.9).toFixed(6)}em`
      );
    }
  };
  calibrate();
  document.fonts?.ready?.then(calibrate);
}
