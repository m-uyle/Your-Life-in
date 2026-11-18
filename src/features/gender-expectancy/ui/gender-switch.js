import { STORAGE_KEYS } from "../../../shared/config/index.js";
import { domRefs } from "../../../shared/lib/dom/index.js";
import { storageSet, storageRemove } from "../../../shared/lib/storage/index.js";
import { lifeState } from "../../../entities/life-calendar/index.js";

export function initGenderSwitch({
  onSyncControlsAria,
  onRenderAllDecades,
  getLensState,
  onRenderLens,
  onStartExpectancyAnim,
}) {
  const toggleGender = (genderKey) => {
    lifeState.gender = lifeState.gender === genderKey ? null : genderKey;
    if (lifeState.gender) {
      storageSet(STORAGE_KEYS.GENDER, lifeState.gender);
    } else {
      storageRemove(STORAGE_KEYS.GENDER);
    }
    onSyncControlsAria();
    if (!lifeState.gender) {
      cancelAnimationFrame(lifeState.expectancyAnimRaf);
      lifeState.expectancyAnimRaf = 0;
    }
    onStartExpectancyAnim();
    if (lifeState.birth) {
      const lensState = getLensState();
      if (!lensState.spec) {
        onRenderAllDecades(false);
      }
      lensState.cascadeElems.forEach((el) => (el.lastStateKey = null));
      onRenderLens(Date.now());
    }
  };

  domRefs.genderM.addEventListener("click", () => toggleGender("m"));
  domRefs.genderF.addEventListener("click", () => toggleGender("f"));
}
