import { domRefs } from "../../../shared/lib/dom/index.js";
import { clamp } from "../../../shared/lib/math/index.js";
import {
  canvasToColMap,
  decadeColumns,
  lifeState,
} from "../../../entities/life-calendar/index.js";
import { renderDecadeColumn, resizeDecadeColumn } from "../model/board-renderer.js";

export function initDecadeBoard({ onUpdateHoverInfo, onMarkLensDirty, getHasLensSpec }) {
  const boardEl = domRefs.board;
  decadeColumns.length = 0;

  for (let idx = 0; idx < 10; idx++) {
    const colEl = document.createElement("div");
    const labelEl = document.createElement("div");
    const canvas = document.createElement("canvas");
    const buf = document.createElement("canvas");

    colEl.className = "decade-column";
    labelEl.className = "decade-label";
    labelEl.textContent = String(10 * (idx + 1));
    canvas.className = "decade-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      `Decade ${idx + 1}: ages ${10 * idx} to ${10 * (idx + 1)}. Use arrow keys to inspect cells.`
    );

    colEl.append(labelEl, canvas);
    boardEl.appendChild(colEl);

    const colObj = {
      idx,
      decade: null,
      canvas,
      ctx: canvas.getContext("2d", { alpha: false }),
      buf,
      bufCtx: buf.getContext("2d", { alpha: false }),
      metrics: null,
      stateKey: null,
      drawnActive: -1,
      units: 0,
      rect: null,
    };
    canvasToColMap.set(canvas, colObj);
    decadeColumns.push(colObj);
  }

  function setActiveBoardCell(col, idx, source) {
    if (
      lifeState.activeBoardCell &&
      col &&
      lifeState.activeBoardCell.col === col &&
      lifeState.activeBoardCell.idx === idx
    ) {
      lifeState.activeBoardCell.source = source;
      return;
    }
    const prevCol = lifeState.activeBoardCell?.col;
    lifeState.activeBoardCell = col && idx !== -1 ? { col, idx, source } : null;
    if (prevCol && prevCol !== col) {
      renderDecadeColumn(prevCol);
    }
    if (col) {
      renderDecadeColumn(col);
    }
    onUpdateHoverInfo();
  }

  const handleBoardPointer = (evt) => {
    const col = canvasToColMap.get(evt.target);
    if (!col) return;

    const hitIdx = ((targetCol, pointerEvt) => {
      const m = targetCol.metrics;
      if (!m || !targetCol.decade) return -1;
      const rect = (targetCol.rect ||= targetCol.canvas.getBoundingClientRect());
      if (!rect.width || !rect.height) return -1;
      const relX = (pointerEvt.clientX - rect.left) * (m.w / rect.width) - m.offX;
      const relY = (pointerEvt.clientY - rect.top) * (m.h / rect.height) - m.offY;
      if (relX < 0 || relY < 0 || relX > m.gridW || relY > m.gridH) return -1;
      const cellIdx =
        Math.min(m.cols - 1, ((relX / m.gridW) * m.cols) | 0) * m.rows +
        Math.min(m.rows - 1, ((relY / m.gridH) * m.rows) | 0);
      return cellIdx < targetCol.units ? cellIdx : -1;
    })(col, evt);

    const source = evt.pointerType === "touch" ? "touch" : "mouse";
    setActiveBoardCell(col, hitIdx, source);
  };

  boardEl.addEventListener("pointermove", handleBoardPointer);
  boardEl.addEventListener("pointerdown", handleBoardPointer);
  boardEl.addEventListener(
    "pointerout",
    (evt) => {
      const col = canvasToColMap.get(evt.target);
      if (
        col &&
        evt.pointerType !== "touch" &&
        lifeState.activeBoardCell?.col === col &&
        lifeState.activeBoardCell.source !== "keyboard"
      ) {
        setActiveBoardCell(col, -1, "mouse");
      }
    },
    { passive: true }
  );

  boardEl.addEventListener("focusin", (evt) => {
    const col = canvasToColMap.get(evt.target);
    if (
      col?.decade &&
      !(lifeState.activeBoardCell?.col === col && lifeState.activeBoardCell.idx !== -1)
    ) {
      setActiveBoardCell(col, 0, "keyboard");
    }
  });

  boardEl.addEventListener("focusout", (evt) => {
    const col = canvasToColMap.get(evt.target);
    if (
      col &&
      lifeState.activeBoardCell?.col === col &&
      lifeState.activeBoardCell.source === "keyboard"
    ) {
      setActiveBoardCell(col, -1, "keyboard");
    }
  });

  boardEl.addEventListener("keydown", (evt) => {
    const col = canvasToColMap.get(evt.target);
    const m = col?.metrics;
    if (!col?.decade || !m) return;

    const totalUnits = col.units || 1;
    const colIdx = col.idx;
    const curIdx =
      lifeState.activeBoardCell?.col === col && lifeState.activeBoardCell.idx >= 0
        ? lifeState.activeBoardCell.idx
        : 0;
    const key = evt.key;

    if (key === "ArrowRight") {
      evt.preventDefault();
      if (curIdx + m.rows < totalUnits) {
        setActiveBoardCell(col, curIdx + m.rows, "keyboard");
      } else if (colIdx < 9) {
        decadeColumns[colIdx + 1].canvas.focus();
        setActiveBoardCell(
          decadeColumns[colIdx + 1],
          Math.min((decadeColumns[colIdx + 1].units || 1) - 1, curIdx % m.rows),
          "keyboard"
        );
      }
    } else if (key === "ArrowLeft") {
      evt.preventDefault();
      if (curIdx - m.rows >= 0) {
        setActiveBoardCell(col, curIdx - m.rows, "keyboard");
      } else if (colIdx > 0) {
        const prevCol = decadeColumns[colIdx - 1];
        const prevM = prevCol.metrics || m;
        prevCol.canvas.focus();
        setActiveBoardCell(
          prevCol,
          clamp((prevM.cols - 1) * prevM.rows + (curIdx % m.rows), 0, (prevCol.units || 1) - 1),
          "keyboard"
        );
      }
    } else {
      const nextIdx = {
        ArrowDown: Math.min(totalUnits - 1, curIdx + 1),
        ArrowUp: Math.max(0, curIdx - 1),
        Home: 0,
        End: totalUnits - 1,
      }[key];
      if (nextIdx !== undefined) {
        evt.preventDefault();
        setActiveBoardCell(col, nextIdx, "keyboard");
      }
    }
  });

  if (window.ResizeObserver) {
    const ro = new ResizeObserver((entries) => {
      const dpr = window.devicePixelRatio || 1;
      const nowMs = Date.now();
      let stageChanged = false;
      for (const entry of entries) {
        if (entry.target === domRefs.stage) {
          stageChanged = true;
          continue;
        }
        const col = canvasToColMap.get(entry.target);
        if (!col) continue;
        col.rect = null;
        const dpBox = entry.devicePixelContentBoxSize?.[0];
        const cBox = entry.contentBoxSize?.[0];
        const pxW = Math.round(
          dpBox ? dpBox.inlineSize : (cBox ? cBox.inlineSize : entry.contentRect.width) * dpr
        );
        if (resizeDecadeColumn(col, pxW) && lifeState.birth) {
          if (!getHasLensSpec()) {
            renderDecadeColumn(col, false, nowMs);
          }
          stageChanged = true;
        }
      }
      if (stageChanged) {
        onMarkLensDirty();
      }
    });

    ro.observe(domRefs.stage);
    decadeColumns.forEach(({ canvas }) => {
      try {
        ro.observe(canvas, { box: "device-pixel-content-box" });
      } catch {
        ro.observe(canvas);
      }
    });
  }

  return {
    setActiveBoardCell,
    renderAllDecades(force = true, nowMs = Date.now()) {
      decadeColumns.forEach((col) => renderDecadeColumn(col, force, nowMs));
    },
  };
}
