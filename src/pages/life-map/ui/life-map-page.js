import { SCALES, STORAGE_KEYS } from "../../../shared/config/index.js";
import { domRefs } from "../../../shared/lib/dom/index.js";
import { storageGet } from "../../../shared/lib/storage/index.js";
import { initTooltip } from "../../../shared/ui/tooltip/index.js";
import {
  decadeColumns,
  invalidateBoardRects,
  lifeState,
  populateLifeTimeline,
  LENS_SPECS,
} from "../../../entities/life-calendar/index.js";
import {
  parseBirthDateIso,
  setMainViewInert,
  transitionEmptyState,
  initBirthDateInput,
} from "../../../features/birth-date-input/index.js";
import { initBirthdayToggle } from "../../../features/birthday-highlight/index.js";
import {
  createExpectancyAnimator,
  initGenderSwitch,
} from "../../../features/gender-expectancy/index.js";
import {
  resetTickerCache,
  updateTicker,
  initTickerFontCalibration,
} from "../../../features/live-ticker/index.js";
import { initHeader } from "../../../widgets/header/index.js";
import {
  renderDecadeColumn,
  resizeDecadeColumn,
  initDecadeBoard,
} from "../../../widgets/decade-board/index.js";
import {
  lensState,
  lensSelectionBox,
  clearLensSelection,
  renderLens,
  rebuildLensCascades,
  initMagnifiedLens,
} from "../../../widgets/magnified-lens/index.js";
import {
  updateHoverInfo,
  syncControlsAriaState,
} from "../../../widgets/footer-bar/index.js";
import { startTickerLoop, stopTickerLoop } from "../model/ticker-loop.js";

export function mountLifeMapPage() {
  const getHasLensSpec = () => !!lensState.spec;

  const { setActiveBoardCell, renderAllDecades } = initDecadeBoard({
    onUpdateHoverInfo: updateHoverInfo,
    onMarkLensDirty: () => {
      lensState.dirty = true;
    },
    getHasLensSpec,
  });

  initMagnifiedLens();

  const startExpectancyLineAnimation = createExpectancyAnimator({
    getLensState: () => lensState,
    renderLens,
    renderDecadeColumn,
  });

  function syncStageAndRender() {
    const hasBirth = lifeState.birth !== null;
    domRefs.board.hidden = !hasBirth;
    const targetLensSpec = (hasBirth && LENS_SPECS[lifeState.scale]) || null;

    if (lensState.spec !== targetLensSpec) {
      rebuildLensCascades(targetLensSpec);
    }

    domRefs.lens.hidden = !lensState.spec;
    domRefs.stage.classList.toggle("has-lens", !!lensState.spec);

    if (!lensState.spec && lensState.boardCapH !== "") {
      domRefs.board.style.maxHeight = lensState.boardCapH = "";
    }

    lensState.key = null;
    lensState.curHM = -1;
    lensState.win = { start: -1, total: 0 };
    lensState.cachedTargetTitle = "";
    lensState.dirty = true;
    lensSelectionBox.style.display = "none";

    if (!hasBirth) {
      domRefs.summaryInfo.style.visibility = "hidden";
      updateHoverInfo();
      return;
    }
    domRefs.summaryInfo.style.visibility = "";

    const nowMs = Date.now();
    const dpr = window.devicePixelRatio || 1;
    updateTicker(nowMs);
    updateHoverInfo();

    const colWidths = decadeColumns.map((col) => {
      col.stateKey = null;
      col.drawnActive = -1;
      col.rect = col.canvas.getBoundingClientRect();
      return Math.round((col.rect.width || col.canvas.clientWidth || 160) * dpr);
    });

    decadeColumns.forEach((col, idx) => {
      if (resizeDecadeColumn(col, colWidths[idx]) && !lensState.spec) {
        renderDecadeColumn(col, true, nowMs);
      }
    });

    if (lensState.spec) {
      renderLens(nowMs);
    }
  }

  function applyBirthDate(birthObj) {
    setActiveBoardCell(null, -1, "mouse");
    lifeState.birth = birthObj;
    resetTickerCache();

    if (!lifeState.birth) {
      stopTickerLoop();
      decadeColumns.forEach((col) => (col.decade = null));
      transitionEmptyState(true);
      syncStageAndRender();
      return;
    }

    transitionEmptyState(false);
    populateLifeTimeline(lifeState.birth);
    startExpectancyLineAnimation();
    syncStageAndRender();
    startTickerLoop();
  }

  const { selectScale } = initHeader({
    onSyncControlsAria: syncControlsAriaState,
    onClearBoardActiveCell: setActiveBoardCell,
    onSyncStageAndRender: syncStageAndRender,
    onStartExpectancyAnim: startExpectancyLineAnimation,
    getHasLensSpec,
  });

  const { populateInputs, focusDayInputSoon } = initBirthDateInput({
    onApplyBirthDate: applyBirthDate,
    onUpdateHoverInfo: updateHoverInfo,
  });

  initBirthdayToggle({
    onSelectScale: selectScale,
    onSyncControlsAria: syncControlsAriaState,
    onRenderAllDecades: renderAllDecades,
    onUpdateHoverInfo: updateHoverInfo,
    getHasLensSpec,
  });

  initGenderSwitch({
    onSyncControlsAria: syncControlsAriaState,
    onRenderAllDecades: renderAllDecades,
    getLensState: () => lensState,
    onRenderLens: renderLens,
    onStartExpectancyAnim: startExpectancyLineAnimation,
  });

  window.addEventListener("scroll", invalidateBoardRects, { passive: true });
  window.addEventListener(
    "resize",
    () => {
      invalidateBoardRects();
      lensState.dirty = true;
    },
    { passive: true }
  );

  document.addEventListener(
    "pointerdown",
    (evt) => {
      const targetEl = evt.target instanceof Element ? evt.target : null;
      if (
        lifeState.activeBoardCell?.source === "touch" &&
        !targetEl?.closest("canvas.decade-canvas")
      ) {
        setActiveBoardCell(null, -1, "touch");
      }
      if (lensState.touchActive && !targetEl?.closest("#lens-cv-wrap, .cascade-cv")) {
        clearLensSelection();
      }
    },
    { passive: true }
  );

  document.addEventListener("visibilitychange", () =>
    document.hidden ? stopTickerLoop() : startTickerLoop()
  );

  initTickerFontCalibration();
  initTooltip();

  // Hydrate persisted preferences from localStorage
  lifeState.showBirthdays = storageGet(STORAGE_KEYS.BIRTHDAYS) === "1";

  const savedGender = storageGet(STORAGE_KEYS.GENDER);
  if (savedGender === "m" || savedGender === "f") {
    lifeState.gender = savedGender;
  }

  const savedScale = storageGet(STORAGE_KEYS.SCALE);
  lifeState.scale = SCALES.includes(savedScale) ? savedScale : "days";

  syncControlsAriaState();

  const savedBirth = parseBirthDateIso(storageGet(STORAGE_KEYS.BIRTH));
  if (savedBirth) {
    populateInputs(savedBirth);
    applyBirthDate(savedBirth);
  } else {
    document.body.classList.add("is-empty");
    setMainViewInert(true);
    syncStageAndRender();
    focusDayInputSoon();
  }
}
