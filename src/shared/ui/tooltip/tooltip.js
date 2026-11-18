import { domRefs } from "../../lib/dom/index.js";

export function initTooltip() {
  const tipEl = domRefs.tip;
  let activeTrigger = null;
  let showTimer = 0;
  let rafId = 0;
  let pointerX = 0;
  let pointerY = 0;
  let curX = 0;
  let curY = 0;
  let targetX = 0;
  let targetY = 0;
  let tipW = 0;
  let tipH = 0;

  const hideTip = () => {
    clearTimeout(showTimer);
    cancelAnimationFrame(rafId);
    rafId = 0;
    tipEl.classList.remove("on");
    activeTrigger?.removeAttribute("aria-describedby");
    activeTrigger = null;
  };

  const computeTargetPosition = () => {
    targetX =
      pointerX + 12 + tipW > innerWidth - 8
        ? Math.max(8, pointerX - tipW - 12)
        : pointerX + 12;
    targetY =
      pointerY + 16 + tipH > innerHeight - 8
        ? pointerY - tipH - 12
        : pointerY + 16;
  };

  const stepPositionAnimation = () => {
    curX += 0.25 * (targetX - curX);
    curY += 0.25 * (targetY - curY);
    tipEl.style.transform = `translate(${curX}px, ${curY}px)`;
    rafId =
      Math.abs(targetX - curX) + Math.abs(targetY - curY) > 0.5
        ? requestAnimationFrame(stepPositionAnimation)
        : 0;
  };

  const showTipFor = (el) => {
    activeTrigger = el;
    tipEl.textContent = el.dataset.tip;
    el.setAttribute("aria-describedby", "tip");
    tipW = tipEl.offsetWidth;
    tipH = tipEl.offsetHeight;
    computeTargetPosition();
    curX = targetX;
    curY = targetY;
    tipEl.style.transform = `translate(${curX}px, ${curY}px)`;
    tipEl.classList.add("on");
  };

  const trackPointer = (evt) => {
    if (evt.pointerType !== "touch") {
      pointerX = evt.clientX;
      pointerY = evt.clientY;
      if (activeTrigger) {
        computeTargetPosition();
        rafId ||= requestAnimationFrame(stepPositionAnimation);
      }
    }
  };

  document.addEventListener("pointerover", (evt) => {
    if (evt.pointerType === "touch") return;
    trackPointer(evt);
    const trigger = evt.target.closest?.("[data-tip]");
    if (trigger !== activeTrigger) {
      hideTip();
      if (trigger) {
        showTimer = setTimeout(showTipFor, 350, trigger);
      }
    }
  });

  document.addEventListener("pointermove", trackPointer);

  document.addEventListener("focusin", (evt) => {
    hideTip();
    const target = evt.target;
    if (target.dataset?.tip && target.matches(":focus-visible")) {
      const rect = target.getBoundingClientRect();
      pointerX = rect.left - 12;
      pointerY = rect.bottom - 16;
      showTipFor(target);
    }
  });

  document.addEventListener("keydown", (evt) => evt.key === "Escape" && hideTip());
  document.addEventListener("pointerdown", hideTip);
  window.addEventListener("scroll", hideTip, { passive: true });
  window.addEventListener("blur", hideTip);
}
