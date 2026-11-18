import { COLORS } from "../../config/index.js";
import { clamp, easeInOutCos } from "../math/index.js";

const sharedCellRect = { x: 0, y: 0, w: 0, h: 0 };

export function getGridCellRect(metrics, cellIndex) {
  const col = (cellIndex / metrics.rows) | 0;
  const row = cellIndex % metrics.rows;
  if (metrics.isDays) {
    sharedCellRect.x = metrics.offX + col * metrics.step;
    sharedCellRect.y = metrics.offY + row * metrics.step;
    sharedCellRect.w = sharedCellRect.h = metrics.cell;
    return sharedCellRect;
  }
  const x0 = ((metrics.gridW * col) / metrics.cols) | 0;
  const x1 = ((metrics.gridW * (col + 1)) / metrics.cols) | 0;
  const y0 = ((metrics.gridH * row) / metrics.rows) | 0;
  const y1 = ((metrics.gridH * (row + 1)) / metrics.rows) | 0;
  sharedCellRect.x = metrics.offX + x0;
  sharedCellRect.y = metrics.offY + y0;
  sharedCellRect.w = Math.max(1, x1 - x0 - (col < metrics.cols - 1 ? metrics.gap : 0));
  sharedCellRect.h = Math.max(
    1,
    y1 - y0 - (row < metrics.rows - 1 ? (metrics.rGap ?? metrics.gap) : 0)
  );
  return sharedCellRect;
}

export const drawRoundedRectPath = (ctx, x, y, w, h, r) =>
  r > 0 && w > 3 && h > 3 && ctx.roundRect
    ? ctx.roundRect(x, y, w, h, r)
    : ctx.rect(x, y, w, h);

export function fillCellRange(ctx, metrics, startIdx, endIdx, fillStyle, bdayFlags, isBdayPass) {
  if (!(startIdx >= endIdx)) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    for (let idx = startIdx; idx < endIdx; idx++) {
      if (bdayFlags && (bdayFlags[idx] === 1) !== isBdayPass) continue;
      const rect = getGridCellRect(metrics, idx);
      drawRoundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, metrics.r);
    }
    ctx.fill();
  }
}

export function drawPartialCell(
  ctx,
  x,
  y,
  w,
  h,
  r,
  fraction,
  livedColor,
  futureColor,
  isVertical = false
) {
  const span = isVertical ? h : w;
  const filledPx = Math.round(span * fraction);
  if (fraction >= 1 || filledPx >= span) {
    ctx.fillStyle = livedColor;
    ctx.beginPath();
    drawRoundedRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    return;
  }
  ctx.fillStyle = futureColor;
  ctx.beginPath();
  drawRoundedRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  if (!(fraction <= 0 || filledPx <= 0)) {
    ctx.fillStyle = livedColor;
    if (r > 0 && w > 3 && h > 3) {
      ctx.save();
      ctx.beginPath();
      drawRoundedRectPath(ctx, x, y, w, h, r);
      ctx.clip();
      ctx.fillRect(x, y, isVertical ? w : filledPx, isVertical ? filledPx : h);
      ctx.restore();
    } else {
      ctx.fillRect(x, y, isVertical ? w : filledPx, isVertical ? filledPx : h);
    }
  }
}

export function drawExpectancyLine(ctx, x, yStart, yEnd, strokeW, animStartPerfMs) {
  const { p: progress, k: glow } = (() => {
    const elapsed = performance.now() - animStartPerfMs;
    if (elapsed <= 0) {
      return { p: 0, k: 0 };
    }
    const tDrop = 500;
    const tBurst = 120;
    const tDecay = 720;

    if (elapsed < tDrop) {
      // 1. Опускается вниз, свечение мягко нарастает
      const f = elapsed / tDrop;
      return {
        p: easeInOutCos(f),
        k: 0.15 + 0.3 * easeInOutCos(f),
      };
    }
    if (elapsed < tDrop + tBurst) {
      // 2. Черта опустилась, свечение быстро и мягко расширяется ("взрывается")
      const f = (elapsed - tDrop) / tBurst;
      return {
        p: 1,
        k: 0.45 + 0.55 * easeInOutCos(f),
      };
    }
    if (elapsed < tDrop + tBurst + tDecay) {
      // 3. Свечение затухает до мягкого небольшого вокруг черты
      const f = (elapsed - (tDrop + tBurst)) / tDecay;
      return {
        p: 1,
        k: 1.0 - easeInOutCos(f),
      };
    }
    // Застывшее состояние (k = 0, мягкое базовое свечение)
    return { p: 1, k: 0 };
  })();

  ctx.save();
  ctx.strokeStyle = COLORS.MARKER;
  ctx.lineWidth = strokeW * (1 + 0.3 * glow);
  ctx.shadowColor = `rgba(255,255,255,${Math.min(1, 0.42 + 0.58 * glow)})`;
  ctx.shadowBlur = clamp(3.5 * strokeW, 6, 10) * (1 + 2 * glow);
  ctx.beginPath();
  ctx.moveTo(x, yStart);
  ctx.lineTo(x, yStart + (yEnd - yStart) * progress);
  ctx.stroke();
  if (glow > 0) {
    ctx.globalAlpha = glow;
    ctx.stroke();
  }
  ctx.restore();
}
