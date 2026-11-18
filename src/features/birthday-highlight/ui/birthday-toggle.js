import { STORAGE_KEYS } from "../../../shared/config/index.js";
import { domRefs } from "../../../shared/lib/dom/index.js";
import { storageSet } from "../../../shared/lib/storage/index.js";
import { lifeState } from "../../../entities/life-calendar/index.js";

export function initBirthdayToggle({
  onSelectScale,
  onSyncControlsAria,
  onRenderAllDecades,
  onUpdateHoverInfo,
  getHasLensSpec,
}) {
  domRefs.bdayToggle.addEventListener("click", () => {
    lifeState.showBirthdays = lifeState.scale !== "days" || !lifeState.showBirthdays;
    storageSet(STORAGE_KEYS.BIRTHDAYS, lifeState.showBirthdays ? "1" : "0");
    if (lifeState.showBirthdays && lifeState.scale !== "days") {
      return onSelectScale("days");
    }
    onSyncControlsAria();
    if (lifeState.birth) {
      if (!getHasLensSpec()) {
        onRenderAllDecades(true);
      }
      onUpdateHoverInfo();
    }
  });
}
