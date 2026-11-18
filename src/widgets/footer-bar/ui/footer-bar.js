import { DEFAULT_HOVER_HINT } from "../../../shared/config/index.js";
import { domRefs } from "../../../shared/lib/dom/index.js";
import {
  addDays,
  diffDays,
  numberFormatter,
  formatDate,
  getCellStatus,
} from "../../../shared/lib/date/index.js";
import {
  yearTimestamps,
  monthTimestamps,
  lifeState,
  getAgeIndexAt,
  getBoardUnit,
} from "../../../entities/life-calendar/index.js";
import { scaleTabButtons } from "../../../features/scale-switcher/index.js";

export function updateHoverInfo() {
  const hoverEl = domRefs.hoverInfo;
  if (!lifeState.activeBoardCell?.col || lifeState.activeBoardCell.idx === -1) {
    hoverEl.textContent = lifeState.birth ? DEFAULT_HOVER_HINT : "";
    return;
  }
  const { col, idx } = lifeState.activeBoardCell;
  const decade = col.decade;
  if (!decade) return;

  const nowMs = Date.now();
  const unit = getBoardUnit();
  let startMs = 0;
  let endMs = 0;
  let unitTitle = "Day";
  let absNum = 0;
  let age = 0;

  if (unit === "days") {
    startMs = addDays(decade.start, idx);
    endMs = addDays(decade.start, idx + 1);
    absNum = diffDays(lifeState.startMs, startMs) + 1;
    age = getAgeIndexAt(startMs);
  } else if (unit === "weeks") {
    const dayOffset = 7 * idx;
    startMs = addDays(decade.start, dayOffset);
    endMs = addDays(decade.start, dayOffset + Math.min(7, decade.days - dayOffset));
    absNum = decade.weekStart + idx + 1;
    unitTitle = "Week";
    age = getAgeIndexAt(startMs);
  } else if (unit === "months") {
    const mIdx = 120 * decade.idx + idx;
    startMs = monthTimestamps[mIdx];
    endMs = monthTimestamps[mIdx + 1];
    absNum = mIdx + 1;
    unitTitle = "Month";
    age = 10 * decade.idx + ((idx / 12) | 0);
  } else {
    const yIdx = 10 * decade.idx + idx;
    startMs = yearTimestamps[yIdx];
    endMs = yearTimestamps[yIdx + 1];
    absNum = yIdx + 1;
    unitTitle = "Year";
    age = yIdx;
  }

  const bdaySuffix =
    unit === "days" && lifeState.showBirthdays && decade.bdays[idx] ? " Your Birthday!" : "";
  hoverEl.textContent = `${unitTitle} #${numberFormatter.format(absNum)} (${formatDate(
    startMs
  )}) — age ${age} [${getCellStatus(nowMs, startMs, endMs)}]${bdaySuffix}`;
}

export function syncControlsAriaState() {
  const bdayActive = lifeState.showBirthdays && lifeState.scale === "days";
  domRefs.bdayToggle.classList.toggle("is-on", bdayActive);
  domRefs.bdayToggle.setAttribute("aria-pressed", String(bdayActive));

  scaleTabButtons.forEach((btn) => {
    const isSelected = btn.dataset.unit === lifeState.scale;
    btn.classList.toggle("is-active", isSelected);
    btn.setAttribute("aria-selected", String(isSelected));
    btn.tabIndex = isSelected ? 0 : -1;
  });

  const activeTabId = `tab-${lifeState.scale}`;
  domRefs.board.setAttribute("aria-labelledby", activeTabId);
  domRefs.lens.setAttribute("aria-labelledby", activeTabId);

  const isMale = lifeState.gender === "m";
  const isFemale = lifeState.gender === "f";
  domRefs.genderM.classList.toggle("is-active", isMale);
  domRefs.genderM.setAttribute("aria-pressed", String(isMale));
  domRefs.genderF.classList.toggle("is-active", isFemale);
  domRefs.genderF.setAttribute("aria-pressed", String(isFemale));
}
