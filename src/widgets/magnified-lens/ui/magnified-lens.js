import {
  DEFAULT_HOVER_HINT,
  COLORS,
  LIFE_EXPECTANCY,
} from "../../../shared/config/index.js";
import { domRefs } from "../../../shared/lib/dom/index.js";
import { clamp } from "../../../shared/lib/math/index.js";
import {
  diffDays,
  numberFormatter,
  formatDate,
  getCellStatus,
} from "../../../shared/lib/date/index.js";
import {
  getGridCellRect,
  drawRoundedRectPath,
  fillCellRange,
  drawPartialCell,
  drawExpectancyLine,
} from "../../../shared/lib/canvas/index.js";
import {
  decadeColumns,
  lifeState,
  getAgeIndexAt,
  formatAgeSpanHtml,
} from "../../../entities/life-calendar/index.js";
import { lensState, lensSelectionBox } from "../model/lens-state.js";

let lensCtx = null;

export function updateMetricFractionDom(containerEl, livedVal, totalVal) {
  if (!containerEl.firstChild) {
    containerEl.innerHTML =
      '<span class="lens-metric-num"></span><span class="lens-metric-of">of</span><span class="lens-metric-num"></span><span class="lens-metric-sep">|</span><span class="lens-metric-num"></span><span class="lens-metric-frac"></span><span class="lens-metric-pct">%</span>';
  }
  const pctStr = clamp((livedVal / totalVal) * 100, 0, 100).toFixed(1);
  const dotIdx = pctStr.indexOf(".");
  const children = containerEl.children;
  [
    [0, numberFormatter.format(clamp(Math.floor(livedVal), 0, totalVal))],
    [2, numberFormatter.format(totalVal)],
    [4, pctStr.slice(0, dotIdx)],
    [5, pctStr.slice(dotIdx)],
  ].forEach(([idx, text]) => {
    if (children[idx].textContent !== text) {
      children[idx].textContent = text;
    }
  });
}

export function clearLensSelection() {
  lensState.touchActive = false;
  lensSelectionBox.style.display = "none";
  domRefs.hoverInfo.textContent = lifeState.birth ? DEFAULT_HOVER_HINT : "";
}

function positionLensSelectionBox(x, y, w, h, scaleX, scaleY, radius, minW = 0, minH = 3) {
  const cssW = w / scaleX;
  const cssH = h / scaleY;
  const boxW = Math.max(cssW, minW);
  const boxH = Math.max(cssH, minH);
  Object.assign(lensSelectionBox.style, {
    display: "block",
    borderRadius: `${Math.max(1, (radius || 1) / (window.devicePixelRatio || 1))}px`,
    left: x / scaleX - (boxW - cssW) / 2 + "px",
    top: y / scaleY - (boxH - cssH) / 2 + "px",
    width: `${boxW}px`,
    height: `${boxH}px`,
  });
}

export function highlightLensCell(cellIdx, subSecOffset = 0, isFinePointer = false, cachedRect = null) {
  const spec = lensState.spec;
  const m = lensState.m;
  if (!spec || !m || !lensState.layoutTotal) return;

  const lensCanvas = domRefs.lensCanvas;
  const rect = cachedRect || lensCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const scaleX = lensCanvas.width / rect.width;
  const scaleY = lensCanvas.height / rect.height;
  const nowMs = Date.now();
  const [unitName, dateFmt] = spec.fmt;

  if (m.is24Hours) {
    const isMinuteRows = m.rows === 60;
    const clampedIdx = clamp(cellIdx, 0, (isMinuteRows ? 1440 : 24) - 1);
    lensState.kbIdx = clampedIdx;
    const secInDay =
      3600 * (isMinuteRows ? (clampedIdx / 60) | 0 : clampedIdx) +
      60 * (isMinuteRows ? clampedIdx % 60 : 0) +
      subSecOffset;
    const cellStartMs = lensState.win.start + 1e3 * secInDay;
    const cellSpanMs = isFinePointer ? 1e3 : isMinuteRows ? 6e4 : 36e5;
    const absSecNum = Math.floor((cellStartMs - lifeState.startMs) / 1e3) + 1;
    domRefs.hoverInfo.textContent = `${unitName} #${numberFormatter.format(
      absSecNum
    )} (${formatDate(cellStartMs, dateFmt)}) — day sec ${numberFormatter.format(
      secInDay + 1
    )} of 86,400 [${getCellStatus(nowMs, cellStartMs, cellStartMs + cellSpanMs)}]`;
    const cellRect = getGridCellRect(m, clampedIdx);
    positionLensSelectionBox(
      cellRect.x,
      cellRect.y,
      cellRect.w,
      cellRect.h,
      scaleX,
      scaleY,
      m.r,
      0,
      isMinuteRows ? 3 : 0
    );
    return;
  }

  const clampedIdx = clamp(cellIdx, 0, lensState.win.total - 1);
  lensState.kbIdx = clampedIdx;
  const cellStartMs = lensState.win.start + clampedIdx * spec.unit;
  domRefs.hoverInfo.textContent = `${unitName} #${numberFormatter.format(
    Math.floor((cellStartMs - lifeState.startMs) / spec.unit) + 1
  )} (${formatDate(cellStartMs, dateFmt)}) — age ${getAgeIndexAt(cellStartMs)} [${getCellStatus(
    nowMs,
    cellStartMs,
    cellStartMs + spec.unit
  )}]`;
  const cellRect = getGridCellRect(m, clampedIdx);
  positionLensSelectionBox(cellRect.x, cellRect.y, cellRect.w, cellRect.h, scaleX, scaleY, m.r, 3, 3);
}

export function renderLens(nowMs) {
  const spec = lensState.spec;
  if (!spec) return;

  const lensCanvas = domRefs.lensCanvas;
  lensCtx ||= lensCanvas.getContext("2d", { alpha: false });

  const wasDirty = lensState.dirty;
  if (wasDirty) {
    (() => {
      const dpr = window.devicePixelRatio || 1;
      const stageRect = domRefs.stage.getBoundingClientRect();
      const boardRect = domRefs.board.getBoundingClientRect();
      let left = boardRect.left - stageRect.left;
      let width = boardRect.width;
      const top = boardRect.top - stageRect.top;
      let height = boardRect.height;

      let minGridLeft = Infinity;
      let maxGridRight = -Infinity;
      let minColTop = Infinity;
      let maxColTop = -Infinity;
      let maxColBottom = -Infinity;
      let firstColH = 0;
      let hasMeasuredCols = false;

      for (let i = 0; i < 10; i++) {
        const col = decadeColumns[i];
        const m = col?.metrics;
        if (!m?.w) continue;
        const cRect = (col.rect ||= col.canvas.getBoundingClientRect());
        if (cRect.width > 0) {
          const gLeft = cRect.left + (m.offX / m.w) * cRect.width;
          const gRight = cRect.left + ((m.offX + m.gridW) / m.w) * cRect.width;
          if (gLeft < minGridLeft) minGridLeft = gLeft;
          if (gRight > maxGridRight) maxGridRight = gRight;
          if (cRect.top < minColTop) minColTop = cRect.top;
          if (cRect.top > maxColTop) maxColTop = cRect.top;
          if (cRect.bottom > maxColBottom) maxColBottom = cRect.bottom;
          if (i === 0) firstColH = cRect.height + 28;
          hasMeasuredCols = true;
        }
      }

      if (hasMeasuredCols && maxGridRight > minGridLeft) {
        left = minGridLeft - stageRect.left;
        width = maxGridRight - minGridLeft;
      }

      const naturalH =
        hasMeasuredCols && maxColBottom > minColTop
          ? maxColBottom - boardRect.top
          : boardRect.height;
      let capStyleH = "";
      if (maxColTop - minColTop > 40 && lensState.spec) {
        height = Math.min(
          naturalH,
          Math.round(Math.max(340, Math.min(0.68 * window.innerHeight, 1.35 * firstColH || 520)))
        );
        capStyleH = `${height}px`;
      } else {
        height = naturalH;
      }

      if (lensState.boardCapH !== capStyleH) {
        domRefs.board.style.maxHeight = lensState.boardCapH = capStyleH;
      }

      if (width > 0 && height > 0) {
        Object.assign(domRefs.lens.style, {
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        });
      }

      const baseStep = Math.max(2, (Math.max(58, decadeColumns[0].canvas.width) / 29) | 0);
      lensState.base = {
        gap: Math.max(1, Math.round(0.2 * baseStep)),
        sw: Math.max(1, Math.round(0.12 * baseStep)),
        r: clamp((0.18 * baseStep) | 0, 1, 3),
      };

      const wrapRect = domRefs.lensCvWrap.getBoundingClientRect();
      lensState.box = {
        w: Math.max(60, Math.round(wrapRect.width * dpr)),
        h: Math.max(60, Math.round(wrapRect.height * dpr)),
      };
      lensState.cachedW = Math.max(100, Math.round((width || domRefs.lens.clientWidth) * dpr));
      lensState.cachedH = Math.max(12, Math.round(16 * dpr));

      if (lensState.cascadeElems.length) {
        lensState.cachedFunnelH =
          lensState.cascadeElems[0].svg.getBoundingClientRect().height || 22;
        lensState.cascadeElems.forEach((el) => (el.lastStateKey = el.lastFunnelKey = null));
      }

      if (document.activeElement !== lensCanvas) {
        lensSelectionBox.style.display = "none";
      }

      lensState.dirty = false;
      lensState.layoutTotal = 0;
      lensState.key = null;
      lensState.curHM = -1;
    })();
  }

  const isCompletedLife = nowMs >= lifeState.endMs;
  const clampedNow = clamp(nowMs, lifeState.startMs, lifeState.endMs - 1);
  const win = spec.win(clampedNow);

  if (win.start !== lensState.win.start || win.total !== lensState.win.total) {
    lensState.win = win;
    lensState.key = null;
    lensState.curHM = -1;
    const titleHtml =
      lifeState.scale === "hours"
        ? formatAgeSpanHtml(win.age ?? getAgeIndexAt(win.start), "hours")
        : lifeState.scale === "minutes"
        ? `<span class="lens-sub-label">week</span> <span class="lens-metric-num">${
            win.weekInYear || 1
          }</span> <span class="lens-sub-label">in minutes</span>`
        : `<span class="lens-sub-label">day</span> <span class="lens-metric-num">${numberFormatter.format(
            diffDays(lifeState.startMs, win.start) + 1
          )}</span> <span class="lens-sub-label">in seconds</span>`;
    if (lensState.cachedTargetTitle !== titleHtml) {
      domRefs.lensTargetTitle.innerHTML = lensState.cachedTargetTitle = titleHtml;
    }
  }

  if (lensState.layoutTotal !== win.total) {
    ((totalCells) => {
      const { w, h } = lensState.box;
      const { sw, gap, r } = lensState.base;
      const gridW = w;
      const gridH = Math.max(20, h - 2 * sw);
      lensCanvas.width = w;
      lensCanvas.height = h;
      lensState.layoutTotal = totalCells;
      lensState.key = null;
      lensState.curHM = -1;

      if (lifeState.scale === "seconds") {
        const rows = gridH >= 180 ? 60 : 1;
        lensState.m = {
          is24Hours: true,
          cols: 24,
          rows,
          gridW,
          gridH,
          offX: 0,
          offY: sw,
          sw,
          gap,
          rGap: rows > 1 ? Math.max(1, (0.75 * gap) | 0) : 0,
          r: rows > 1 ? Math.min(2, r) : r,
        };
        return;
      }

      const idealCols = Math.sqrt(totalCells * (gridW / gridH));
      const cFloor = clamp(idealCols | 0, 1, totalCells);
      const cCeil = clamp(Math.ceil(idealCols), 1, totalCells);
      const costFn = (cols) => {
        const rows = Math.ceil(totalCells / cols);
        const cellW = gridW / cols;
        const cellH = gridH / rows;
        return cellW < 1.5 || cellH < 1.5
          ? Infinity
          : 4 * (Math.max(cellW / cellH, cellH / cellW) - 1) +
              ((cols * rows - totalCells) / cols) * 0.35;
      };
      const bestCols = costFn(cFloor) <= costFn(cCeil) ? cFloor : cCeil;
      lensState.m = {
        is24Hours: false,
        cols: bestCols,
        rows: Math.ceil(totalCells / bestCols),
        gridW,
        gridH,
        gap,
        offX: 0,
        offY: sw,
        r,
        sw,
      };
    })(win.total);
  }

  if (wasDirty && document.activeElement === lensCanvas && lensState.kbIdx >= 0) {
    highlightLensCell(lensState.kbIdx);
  }

  const m = lensState.m;
  const effNow = isCompletedLife ? win.end : clampedNow;
  const elapsedInWin = m.is24Hours
    ? 86400 * clamp((effNow - win.start) / Math.max(1, win.end - win.start), 0, 1)
    : clamp((effNow - win.start) / spec.unit, 0, win.total);

  updateMetricFractionDom(domRefs.lensTargetCap, elapsedInWin, win.total);

  const dpr = window.devicePixelRatio || 1;
  const casW = lensState.cachedW;
  const casH = lensState.cachedH;
  const { sw, gap, r } = lensState.base;
  const numCascades = lensState.cascadeElems.length;

  for (let i = 0; i < numCascades; i++) {
    const casEl = lensState.cascadeElems[i];
    const cSpec = casEl.cSpec;
    const rangeObj = cSpec.range(clampedNow);
    const total = rangeObj.total || cSpec.units;
    const elProgress = cSpec.getEl(isCompletedLife ? rangeObj.end : clampedNow, rangeObj);
    const curCell = Math.min(total - 1, elProgress | 0);
    const curFrac = Math.min(1, elProgress - curCell);
    const sizeChanged = casEl.cv.width !== casW || casEl.cv.height !== casH;

    if (sizeChanged) {
      casEl.cv.width = casW;
      casEl.cv.height = casH;
    }

    if (i > 0) {
      const tHtml = cSpec.titleHtml(rangeObj.start);
      if (casEl.cachedTitle !== tHtml) {
        casEl.title.innerHTML = casEl.cachedTitle = tHtml;
      }
      updateMetricFractionDom(casEl.cap, elProgress, total);
    }

    const cellLeft = (idx) => ((casW * idx) / total) | 0;
    const cellWidth = (idx) => cellLeft(idx + 1) - cellLeft(idx) - (idx < total - 1 ? gap : 0);
    const casStateKey = `${curCell}:${Math.round(128 * curFrac)}:${lifeState.gender || ""}`;

    if (sizeChanged || casEl.lastStateKey !== casStateKey) {
      casEl.lastStateKey = casStateKey;
      const cCtx = casEl.ctx;
      cCtx.fillStyle = COLORS.BG;
      cCtx.fillRect(0, 0, casW, casH);

      cCtx.fillStyle = COLORS.CELL_FUTURE;
      cCtx.beginPath();
      for (let j = curCell + 1; j < total; j++) {
        drawRoundedRectPath(cCtx, cellLeft(j), 0, cellWidth(j), casH, r);
      }
      cCtx.fill();

      cCtx.fillStyle = COLORS.CELL_LIVED;
      cCtx.beginPath();
      for (let j = 0; j < curCell; j++) {
        drawRoundedRectPath(cCtx, cellLeft(j), 0, cellWidth(j), casH, r);
      }
      cCtx.fill();

      drawPartialCell(
        cCtx,
        cellLeft(curCell),
        0,
        cellWidth(curCell),
        casH,
        r,
        curFrac,
        COLORS.CELL_LIVED,
        COLORS.CELL_FUTURE
      );

      if (i === 0 && lifeState.gender && LIFE_EXPECTANCY[lifeState.gender]) {
        const expVal = LIFE_EXPECTANCY[lifeState.gender];
        const expIdx = Math.min(99, expVal | 0);
        drawExpectancyLine(
          cCtx,
          Math.round(cellLeft(expIdx) + cellWidth(expIdx) * (expVal - expIdx)) + 0.5,
          0,
          casH,
          sw,
          lifeState.expectancyAnimStart
        );
      }
    }

    const funnelH = lensState.cachedFunnelH;
    const funnelKey = `${curCell}:${casW}:${Math.round(funnelH)}`;
    if (sizeChanged || casEl.lastFunnelKey !== funnelKey) {
      casEl.lastFunnelKey = funnelKey;
      const topL = cellLeft(curCell);
      const topW = cellWidth(curCell);
      const botL = i < numCascades - 1 ? 0 : m.offX;
      const botR = i < numCascades - 1 ? casW : m.offX + m.gridW;
      const hCss = funnelH;
      const midY = funnelH / 2;
      const wCss = casW / dpr;

      casEl.svg.setAttribute("viewBox", `0 0 ${wCss.toFixed(2)} ${funnelH.toFixed(2)}`);

      const buildFunnelPath = (xTop, xBot) => {
        const x0 = clamp(xTop, 0.75, wCss - 0.75);
        const x1 = clamp(xBot, 0.75, wCss - 0.75);
        const dx = x1 - x0;
        const absDx = Math.abs(dx);
        if (absDx < 1) return `M ${x0} 0 V ${hCss}`;
        const dir = dx > 0 ? 1 : -1;
        const vCurve = Math.max(2, midY - Math.min(4, 0.2 * midY));
        const hCurve = Math.min(absDx / 2, Math.max(2.6 * vCurve, Math.min(110, 0.36 * absDx)));
        return `M ${x0} 0 V ${midY - vCurve} C ${x0} ${midY - 0.28 * vCurve} ${
          x0 + dir * hCurve * 0.42
        } ${midY} ${x0 + dir * hCurve} ${midY} H ${x1 - dir * hCurve} C ${
          x1 - dir * hCurve * 0.42
        } ${midY} ${x1} ${midY + 0.28 * vCurve} ${x1} ${midY + vCurve} V ${hCss}`;
      };

      casEl.pathL.setAttribute("d", buildFunnelPath(topL / dpr, botL / dpr));
      casEl.pathR.setAttribute("d", buildFunnelPath((topL + topW) / dpr, botR / dpr));
    }
  }

  const gridCapacity = m.cols * m.rows;
  const activeTotal = m.is24Hours ? gridCapacity : win.total;
  const isVerticalFill = !m.is24Hours || m.rows === 1;
  const scaledProgress = m.is24Hours ? (elapsedInWin / 86400) * activeTotal : elapsedInWin;
  const curCellIdx = Math.min(activeTotal - 1, scaledProgress | 0);
  const rawFrac = Math.min(1, scaledProgress - curCellIdx);
  const quantFrac = m.is24Hours ? rawFrac : Math.round(8 * rawFrac) / 8;
  const { x: cx, y: cy, w: cw, h: ch } = getGridCellRect(m, curCellIdx);
  const drawKey = `${curCellIdx}:${Math.round(
    (m.is24Hours ? (isVerticalFill ? m.gridH : cw) : 8) * quantFrac
  )}`;

  if (drawKey !== lensState.key) {
    if (lensState.key === null || lensState.curHM !== curCellIdx) {
      lensCtx.fillStyle = COLORS.BG;
      lensCtx.fillRect(0, 0, lensCanvas.width, lensCanvas.height);
      fillCellRange(lensCtx, m, 0, curCellIdx, COLORS.CELL_LIVED);
      fillCellRange(lensCtx, m, curCellIdx + 1, activeTotal, COLORS.CELL_FUTURE);
      if (gridCapacity > activeTotal) {
        fillCellRange(lensCtx, m, activeTotal, gridCapacity, COLORS.CELL_OVERFLOW);
      }
    } else {
      lensCtx.fillStyle = COLORS.BG;
      lensCtx.fillRect(cx, cy, cw, ch);
    }
    lensState.key = drawKey;
    lensState.curHM = curCellIdx;
    drawPartialCell(
      lensCtx,
      cx,
      cy,
      cw,
      ch,
      m.r,
      quantFrac,
      COLORS.CELL_LIVED,
      COLORS.CELL_FUTURE,
      isVerticalFill
    );
  }
}

export function rebuildLensCascades(newSpec) {
  lensState.spec = newSpec;
  lensState.kbIdx = -1;
  const stackEl = domRefs.lensStack;
  stackEl.innerHTML = "";
  lensState.cascadeElems = [];

  if (!newSpec) return;

  newSpec.cascades.forEach((cSpec, idx) => {
    const isLifeRoot = idx === 0;
    const svgNs = "http://www.w3.org/2000/svg";
    const levelEl = document.createElement("div");
    const headEl = document.createElement("div");
    const leftSpan = document.createElement("span");
    const rightSpan = document.createElement("span");
    const cv = document.createElement("canvas");
    const svg = document.createElementNS(svgNs, "svg");
    const pathL = document.createElementNS(svgNs, "path");
    const pathR = document.createElementNS(svgNs, "path");

    levelEl.className = "cascade-level" + (isLifeRoot ? " is-life" : "");
    headEl.className = "cascade-head";
    if (isLifeRoot) {
      leftSpan.textContent = "1 year";
      rightSpan.className = "cascade-head-right";
      rightSpan.textContent = "100";
    } else {
      leftSpan.className = "lens-title-group";
      rightSpan.className = "lens-title-group cascade-head-right";
    }
    headEl.append(leftSpan, rightSpan);

    cv.className = "cascade-cv";
    cv.tabIndex = 0;
    cv.setAttribute("role", "img");
    cv.setAttribute(
      "aria-label",
      (isLifeRoot ? "100 years of life" : `Current year in ${cSpec.unitLabel || "units"}`) +
        ". Use Left and Right arrow keys to inspect."
    );

    svg.setAttribute("class", "zoom-funnel");
    svg.setAttribute("viewBox", "0 0 1000 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.append(pathL, pathR);

    levelEl.append(headEl, cv, svg);
    stackEl.appendChild(levelEl);

    const casItem = {
      cSpec,
      title: leftSpan,
      cap: rightSpan,
      cv,
      ctx: cv.getContext("2d", { alpha: false }),
      svg,
      pathL,
      pathR,
      cachedTitle: "",
      lastStateKey: null,
      lastFunnelKey: null,
      kbIdx: -1,
    };

    const inspectCascadeCell = (cellIdx, nowMs = Date.now()) => {
      const rangeObj = cSpec.range(nowMs);
      const total = rangeObj.total || cSpec.units;
      const clampedIdx = clamp(cellIdx, 0, total - 1);
      const info = cSpec.cellRange(clampedIdx, rangeObj);
      casItem.kbIdx = clampedIdx;
      domRefs.hoverInfo.textContent = `${info.label} [${getCellStatus(
        nowMs,
        info.start,
        info.end
      )}]`;
    };

    const handleCascadePointer = (evt) => {
      if (evt.pointerType === "touch") {
        lensState.touchActive = true;
      }
      const rect = cv.getBoundingClientRect();
      if (!rect.width) return;
      const relX = (evt.clientX - rect.left) * (cv.width / rect.width);
      if (relX < 0 || relX > cv.width) return;
      const nowMs = Date.now();
      const total = cSpec.range(nowMs).total || cSpec.units;
      inspectCascadeCell(clamp(((relX / cv.width) * total) | 0, 0, total - 1), nowMs);
    };

    cv.addEventListener("pointermove", handleCascadePointer);
    cv.addEventListener("pointerdown", handleCascadePointer);
    cv.addEventListener(
      "pointerleave",
      (evt) => {
        if (evt.pointerType !== "touch") {
          domRefs.hoverInfo.textContent = lifeState.birth ? DEFAULT_HOVER_HINT : "";
        }
      },
      { passive: true }
    );
    cv.addEventListener("focus", () => {
      if (!lifeState.birth) return;
      const nowMs = Date.now();
      const rangeObj = cSpec.range(nowMs);
      inspectCascadeCell(
        casItem.kbIdx >= 0 ? casItem.kbIdx : cSpec.getEl(nowMs, rangeObj) | 0,
        nowMs
      );
    });
    cv.addEventListener("blur", () => {
      domRefs.hoverInfo.textContent = lifeState.birth ? DEFAULT_HOVER_HINT : "";
    });
    cv.addEventListener("keydown", (evt) => {
      if (!lifeState.birth) return;
      const nowMs = Date.now();
      const rangeObj = cSpec.range(nowMs);
      const total = rangeObj.total || cSpec.units;
      const curIdx = casItem.kbIdx >= 0 ? casItem.kbIdx : cSpec.getEl(nowMs, rangeObj) | 0;
      const nextIdx = {
        ArrowRight: curIdx + 1,
        ArrowDown: curIdx + 1,
        ArrowLeft: curIdx - 1,
        ArrowUp: curIdx - 1,
        Home: 0,
        End: total - 1,
      }[evt.key];
      if (nextIdx !== undefined) {
        evt.preventDefault();
        inspectCascadeCell(nextIdx, nowMs);
      }
    });

    lensState.cascadeElems.push(casItem);
  });
}

export function initMagnifiedLens() {
  const wrapEl = domRefs.lensCvWrap;
  const lensCanvas = domRefs.lensCanvas;

  lensSelectionBox.className = "lens-selection-box";
  wrapEl.appendChild(lensSelectionBox);

  const handleLensPointer = (evt) => {
    if (evt.pointerType === "touch") {
      lensState.touchActive = true;
    }
    const spec = lensState.spec;
    const m = lensState.m;
    if (!spec || !m || !lensState.layoutTotal) return;
    const rect = lensCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const relX = (evt.clientX - rect.left) * (lensCanvas.width / rect.width) - m.offX;
    const relY = (evt.clientY - rect.top) * (lensCanvas.height / rect.height) - m.offY;
    if (relX < 0 || relY < 0 || relX >= m.gridW || relY >= m.gridH) {
      return clearLensSelection();
    }
    if (m.is24Hours) {
      const hourCol = clamp(((relX / m.gridW) * 24) | 0, 0, 23);
      if (m.rows === 60) {
        const minRow = clamp(((relY / m.gridH) * 60) | 0, 0, 59);
        const cellRect = getGridCellRect(m, 60 * hourCol + minRow);
        const subX = clamp((relX + m.offX - cellRect.x) / Math.max(1, cellRect.w), 0, 0.999);
        highlightLensCell(60 * hourCol + minRow, clamp((60 * subX) | 0, 0, 59), true, rect);
      } else {
        const subY = clamp(relY / Math.max(1, m.gridH), 0, 0.999);
        highlightLensCell(hourCol, clamp((3600 * subY) | 0, 0, 3599), true, rect);
      }
      return;
    }
    const cellIdx =
      Math.min(m.cols - 1, ((relX / m.gridW) * m.cols) | 0) * m.rows +
      Math.min(m.rows - 1, ((relY / m.gridH) * m.rows) | 0);
    if (cellIdx < 0 || cellIdx >= lensState.win.total) {
      return clearLensSelection();
    }
    highlightLensCell(cellIdx, 0, false, rect);
  };

  wrapEl.addEventListener("pointermove", handleLensPointer);
  wrapEl.addEventListener("pointerdown", handleLensPointer);
  wrapEl.addEventListener(
    "pointerleave",
    (evt) => {
      if (evt.pointerType !== "touch" && document.activeElement !== lensCanvas) {
        clearLensSelection();
      }
    },
    { passive: true }
  );

  lensCanvas.addEventListener("focus", () => {
    if (!lifeState.birth || !lensState.m) return;
    const m = lensState.m;
    if (lensState.kbIdx < 0) {
      const nowMs = Date.now();
      if (m.is24Hours) {
        const secElapsed = clamp((nowMs - lensState.win.start) / 1e3, 0, 86399);
        lensState.kbIdx = m.rows === 60 ? (secElapsed / 60) | 0 : (secElapsed / 3600) | 0;
      } else {
        lensState.kbIdx = clamp(
          ((nowMs - lensState.win.start) / lensState.spec.unit) | 0,
          0,
          lensState.win.total - 1
        );
      }
    }
    highlightLensCell(lensState.kbIdx);
  });

  lensCanvas.addEventListener("blur", clearLensSelection);

  lensCanvas.addEventListener("keydown", (evt) => {
    if (!lifeState.birth || !lensState.m) return;
    const m = lensState.m;
    const total = m.is24Hours ? m.cols * m.rows : lensState.win.total;
    const rows = m.rows || 1;
    const curIdx = clamp(lensState.kbIdx, 0, total - 1);
    const nextIdx = {
      ArrowDown: curIdx + 1,
      ArrowUp: curIdx - 1,
      ArrowRight: curIdx + rows,
      ArrowLeft: curIdx - rows,
      Home: 0,
      End: total - 1,
    }[evt.key];
    if (nextIdx !== undefined) {
      evt.preventDefault();
      highlightLensCell(nextIdx);
    }
  });
}
