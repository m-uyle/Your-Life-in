import {
  decadeColumns,
  lifeState,
} from "../../../entities/life-calendar/index.js";
import { updateTicker } from "../../../features/live-ticker/index.js";
import { renderDecadeColumn } from "../../../widgets/decade-board/index.js";
import { lensState, renderLens } from "../../../widgets/magnified-lens/index.js";

let rafLoopId = null;
let lastTickMs = 0;

function tickFrame() {
  if (!lifeState.birth || document.hidden) {
    rafLoopId = null;
    return;
  }
  const nowMs = Date.now();
  if (nowMs - lastTickMs >= (lifeState.scale === "seconds" ? 45 : 60)) {
    lastTickMs = nowMs;
    updateTicker(nowMs);
    if (lensState.spec) {
      renderLens(nowMs);
    } else {
      for (let i = 0; i < 10; i++) {
        const col = decadeColumns[i];
        const dec = col.decade;
        if (dec && col.metrics && nowMs >= dec.start && nowMs < dec.end) {
          renderDecadeColumn(col, false, nowMs);
        }
      }
    }
  }
  rafLoopId = requestAnimationFrame(tickFrame);
}

export const startTickerLoop = () => {
  if (!rafLoopId && !document.hidden && lifeState.birth) {
    lastTickMs = 0;
    rafLoopId = requestAnimationFrame(tickFrame);
  }
};

export const stopTickerLoop = () => {
  if (rafLoopId) {
    cancelAnimationFrame(rafLoopId);
    rafLoopId = null;
  }
};
