import { domRefs } from "../../../shared/lib/dom/index.js";
import { lifeState } from "../../../entities/life-calendar/index.js";

export function setMainViewInert(isEmpty) {
  const inertTargets = [
    domRefs.appHeader,
    domRefs.stage,
    domRefs.genderSwitch,
    domRefs.summaryInfo,
    domRefs.hoverInfo,
  ];
  for (const el of inertTargets) {
    el.toggleAttribute("inert", isEmpty);
  }
  domRefs.bdayToggle.tabIndex = isEmpty ? -1 : 0;
}

export function transitionEmptyState(isEmpty) {
  setMainViewInert(isEmpty);
  if (document.body.classList.contains("is-empty") === isEmpty) return;

  lifeState.emptyFlipCleanup?.();
  const controlsEl = domRefs.controls;
  const birthFieldsEl = domRefs.birthFields;
  controlsEl.style.transition = controlsEl.style.transform = "";

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    document.body.classList.toggle("is-empty", isEmpty);
    return;
  }

  const firstRect = birthFieldsEl.getBoundingClientRect();
  document.body.classList.toggle("is-empty", isEmpty);

  if (firstRect.width > 0 && firstRect.height > 0) {
    const lastRect = birthFieldsEl.getBoundingClientRect();
    const dx = firstRect.left - lastRect.left;
    const dy = firstRect.top - lastRect.top;

    controlsEl.style.transform = isEmpty
      ? `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
      : `translate(${dx}px, ${dy}px)`;
    controlsEl.style.transition = "none";
    void controlsEl.offsetHeight;
    controlsEl.style.transition = "transform 0.85s cubic-bezier(0.16, 1, 0.3, 1)";
    controlsEl.style.transform = isEmpty ? "translate(-50%, -50%)" : "";

    const cleanup = () => {
      controlsEl.style.transition = controlsEl.style.transform = "";
      controlsEl.removeEventListener("transitionend", onTransitionEnd);
      lifeState.emptyFlipCleanup = null;
    };
    const onTransitionEnd = (evt) =>
      evt.target === controlsEl && evt.propertyName === "transform" && cleanup();

    lifeState.emptyFlipCleanup = cleanup;
    controlsEl.addEventListener("transitionend", onTransitionEnd);
  }
}
