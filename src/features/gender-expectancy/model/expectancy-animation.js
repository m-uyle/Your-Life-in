import { LIFE_EXPECTANCY } from "../../../shared/config/index.js";
import {
  lifeState,
  decadeColumns,
} from "../../../entities/life-calendar/index.js";

export function createExpectancyAnimator({
  getLensState,
  renderLens,
  renderDecadeColumn,
}) {
  return function startExpectancyLineAnimation() {
    cancelAnimationFrame(lifeState.expectancyAnimRaf);
    lifeState.expectancyAnimRaf = 0;
    if (
      !lifeState.birth ||
      !lifeState.gender ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      return;
    }
    lifeState.expectancyAnimStart = performance.now();
    const step = () => {
      if (!lifeState.birth || !lifeState.gender) return;
      const done = performance.now() - lifeState.expectancyAnimStart >= 1350;
      const lensState = getLensState();
      if (lensState.spec) {
        lensState.cascadeElems.forEach((el) => (el.lastStateKey = null));
        renderLens(Date.now());
      } else {
        const col = decadeColumns[(LIFE_EXPECTANCY[lifeState.gender] / 10) | 0];
        if (col?.metrics) {
          renderDecadeColumn(col, false);
        }
      }
      lifeState.expectancyAnimRaf = done ? 0 : requestAnimationFrame(step);
    };
    step();
  };
}
