import { SCALES, STORAGE_KEYS } from "../../../shared/config/index.js";
import { domRefs } from "../../../shared/lib/dom/index.js";
import { storageSet } from "../../../shared/lib/storage/index.js";
import {
  lifeState,
  LENS_SPECS,
  invalidateBoardRects,
} from "../../../entities/life-calendar/index.js";

export const scaleTabButtons = [];

export function initScaleSwitcher({
  onSyncControlsAria,
  onClearBoardActiveCell,
  onSyncStageAndRender,
  onStartExpectancyAnim,
  getHasLensSpec,
}) {
  const navEl = domRefs.scaleNav;
  scaleTabButtons.length = 0;

  SCALES.forEach((unit) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.id = `tab-${unit}`;
    btn.className = "scale-tab";
    btn.dataset.unit = unit;
    btn.setAttribute("aria-controls", LENS_SPECS[unit] ? "lens" : "board");
    btn.textContent = unit[0].toUpperCase() + unit.slice(1);
    navEl.appendChild(btn);
    scaleTabButtons.push(btn);
  });

  const selectScale = (unit) => {
    if (unit && lifeState.scale !== unit) {
      const hadLens = getHasLensSpec();
      lifeState.scale = unit;
      storageSet(STORAGE_KEYS.SCALE, unit);
      onSyncControlsAria();
      onClearBoardActiveCell(null, -1, "mouse");
      onStartExpectancyAnim();
      onSyncStageAndRender();
      if (hadLens !== getHasLensSpec()) {
        const activePane = getHasLensSpec() ? domRefs.lens : domRefs.board;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
          activePane.classList.remove("pane-in");
          invalidateBoardRects();
        } else {
          activePane.classList.remove("pane-in");
          void activePane.offsetWidth;
          activePane.classList.add("pane-in");
          activePane.addEventListener(
            "animationend",
            () => {
              activePane.classList.remove("pane-in");
              invalidateBoardRects();
            },
            { once: true }
          );
        }
      }
    }
  };

  navEl.addEventListener("click", (evt) =>
    selectScale(evt.target.closest(".scale-tab")?.dataset.unit)
  );

  navEl.addEventListener("keydown", (evt) => {
    const curIdx = SCALES.indexOf(lifeState.scale);
    const nextIdx = {
      ArrowRight: (curIdx + 1) % SCALES.length,
      ArrowLeft: (curIdx + SCALES.length - 1) % SCALES.length,
      Home: 0,
      End: SCALES.length - 1,
    }[evt.key];
    if (nextIdx !== undefined) {
      evt.preventDefault();
      scaleTabButtons[nextIdx].focus();
      selectScale(SCALES[nextIdx]);
    }
  });

  return { selectScale };
}
