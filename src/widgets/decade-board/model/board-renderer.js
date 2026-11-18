import {
  BOARD_GRID_DIMS,
  COLORS,
  LIFE_EXPECTANCY,
} from "../../../shared/config/index.js";
import { clamp } from "../../../shared/lib/math/index.js";
import {
  getGridCellRect,
  drawRoundedRectPath,
  fillCellRange,
  drawPartialCell,
  drawExpectancyLine,
} from "../../../shared/lib/canvas/index.js";
import {
  yearTimestamps,
  monthTimestamps,
  lifeState,
  findIntervalIndex,
  getIntervalFraction,
  getDayStepProgress,
  getAgeIndexAt,
  getBoardUnit,
} from "../../../entities/life-calendar/index.js";

export function renderDecadeColumn(col, forceRedraw = false, nowMs = Date.now()) {
  const { decade, ctx, buf, bufCtx, metrics } = col;
  if (!metrics || !decade) return;

  const unit = getBoardUnit();
  const totalUnits =
    unit === "days"
      ? decade.days
      : unit === "weeks"
      ? decade.weeks
      : unit === "months"
      ? 120
      : 10;

  let progress = 0;
  if (nowMs < decade.start) {
    progress = -1;
  } else if (nowMs >= decade.end) {
    progress = totalUnits;
  } else if (unit === "days" || unit === "weeks") {
    progress = getDayStepProgress(
      decade.start,
      decade.end,
      totalUnits,
      unit === "days" ? 1 : 7,
      nowMs
    );
  } else if (unit === "months") {
    const baseMonthIdx = 120 * decade.idx;
    const relMonth = findIntervalIndex(
      monthTimestamps,
      baseMonthIdx,
      119,
      nowMs,
      ((nowMs - decade.start) / decade.ms) * 120
    );
    progress = relMonth + getIntervalFraction(monthTimestamps, baseMonthIdx + relMonth, nowMs);
  } else {
    const baseYearIdx = 10 * decade.idx;
    const relYear = clamp(getAgeIndexAt(nowMs) - baseYearIdx, 0, 9);
    progress = relYear + getIntervalFraction(yearTimestamps, baseYearIdx + relYear, nowMs);
  }

  const curIdx = Math.floor(progress);
  const curFrac = clamp(progress - curIdx, 0, 1);
  const bdayFlag = lifeState.showBirthdays && unit === "days" ? 1 : 0;
  const stateKey = `${unit}:${curIdx}:${Math.round(128 * curFrac)}:${bdayFlag}`;
  const activeIdx =
    lifeState.activeBoardCell?.col === col &&
    lifeState.activeBoardCell.idx >= 0 &&
    lifeState.activeBoardCell.idx < totalUnits
      ? lifeState.activeBoardCell.idx
      : -1;

  if (forceRedraw || col.stateKey !== stateKey) {
    bufCtx.fillStyle = COLORS.BG;
    bufCtx.fillRect(0, 0, metrics.w, metrics.h);

    const livedEnd = clamp(curIdx, 0, totalUnits);
    const futureStart = Math.max(0, curIdx + 1);
    const gridCapacity = metrics.cols * metrics.rows;
    const bdayMask = bdayFlag ? decade.bdays : null;

    fillCellRange(bufCtx, metrics, 0, livedEnd, COLORS.CELL_LIVED, bdayMask, false);
    fillCellRange(bufCtx, metrics, futureStart, totalUnits, COLORS.CELL_FUTURE, bdayMask, false);
    if (gridCapacity > totalUnits) {
      fillCellRange(bufCtx, metrics, totalUnits, gridCapacity, COLORS.CELL_OVERFLOW, null, false);
    }
    if (bdayMask) {
      fillCellRange(bufCtx, metrics, 0, livedEnd, COLORS.BDAY_LIVED, bdayMask, true);
      fillCellRange(bufCtx, metrics, futureStart, totalUnits, COLORS.BDAY_FUTURE, bdayMask, true);
    }
    if (curIdx >= 0 && curIdx < totalUnits) {
      const cellRect = getGridCellRect(metrics, curIdx);
      const isBday = bdayMask?.[curIdx] === 1;
      drawPartialCell(
        bufCtx,
        cellRect.x,
        cellRect.y,
        cellRect.w,
        cellRect.h,
        metrics.r,
        curFrac,
        isBday ? COLORS.BDAY_LIVED : COLORS.CELL_LIVED,
        isBday ? COLORS.BDAY_FUTURE : COLORS.CELL_FUTURE,
        unit !== "years"
      );
    }
    col.stateKey = stateKey;
    col.units = totalUnits;
  }

  ctx.drawImage(buf, 0, 0);
  col.drawnActive = activeIdx;

  if (
    lifeState.gender &&
    LIFE_EXPECTANCY[lifeState.gender] >= 10 * decade.idx &&
    LIFE_EXPECTANCY[lifeState.gender] < 10 * (decade.idx + 1)
  ) {
    const relYears = LIFE_EXPECTANCY[lifeState.gender] - 10 * decade.idx;
    let lineX = metrics.offX + metrics.gridW * (relYears / 10);
    if (unit === "years") {
      const yearCellIdx = Math.min(9, relYears | 0);
      const cellRect = getGridCellRect(metrics, yearCellIdx);
      lineX = cellRect.x + cellRect.w * (relYears - yearCellIdx);
    }
    drawExpectancyLine(
      ctx,
      Math.round(lineX) + 0.5,
      metrics.offY,
      metrics.offY + metrics.gridH,
      metrics.sw,
      lifeState.expectancyAnimStart
    );
  }

  if (activeIdx !== -1) {
    const cellRect = getGridCellRect(metrics, activeIdx);
    const sw = metrics.sw;
    const halfSw = sw / 2;
    ctx.save();
    ctx.strokeStyle = COLORS.TEXT_MAIN;
    ctx.lineWidth = sw;
    ctx.beginPath();
    drawRoundedRectPath(
      ctx,
      cellRect.x - halfSw,
      cellRect.y - halfSw,
      cellRect.w + sw,
      cellRect.h + sw,
      metrics.r + 0.5
    );
    ctx.stroke();
    ctx.restore();
  }
}

export function resizeDecadeColumn(col, targetWidthPx) {
  if (!(targetWidthPx > 0)) return false;

  const metrics = ((widthPx, unit) => {
    const w = Math.max(58, widthPx);
    const step = Math.max(2, (w / 29) | 0);
    const gap = Math.max(1, Math.round(0.2 * step));
    const sw = Math.max(1, Math.round(0.12 * step));
    const gridW = 29 * step - gap;
    const gridH = 126 * step - gap;
    const [cols, rows] = BOARD_GRID_DIMS[unit] || BOARD_GRID_DIMS.days;
    const isDays = unit === "days";
    return {
      w,
      h: gridH + 2 * sw,
      cols,
      rows,
      step,
      cell: Math.max(1, step - gap),
      sw,
      gap,
      gridW,
      gridH,
      offX: Math.max(sw, ((w - gridW) / 2) | 0),
      offY: sw,
      isDays,
      r: isDays ? 1 : clamp((0.18 * step) | 0, 1, 3),
    };
  })(targetWidthPx, getBoardUnit());

  const dpr = window.devicePixelRatio || 1;
  if (
    col.metrics &&
    col.canvas.width === metrics.w &&
    col.canvas.height === metrics.h &&
    col.metrics.cols === metrics.cols &&
    col.metrics.rows === metrics.rows
  ) {
    col.metrics = metrics;
    return true;
  }

  col.canvas.width = col.buf.width = metrics.w;
  col.canvas.height = col.buf.height = metrics.h;
  col.canvas.style.height = `${(metrics.h / dpr).toFixed(2)}px`;
  col.canvas.style.aspectRatio = `${metrics.w} / ${metrics.h}`;
  col.metrics = metrics;
  col.stateKey = col.rect = null;
  col.drawnActive = -1;
  return true;
}
