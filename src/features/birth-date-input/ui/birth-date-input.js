import { STORAGE_KEYS } from "../../../shared/config/index.js";
import { domRefs } from "../../../shared/lib/dom/index.js";
import { pad2 } from "../../../shared/lib/math/index.js";
import { daysInMonth } from "../../../shared/lib/date/index.js";
import { storageSet, storageRemove } from "../../../shared/lib/storage/index.js";
import { lifeState } from "../../../entities/life-calendar/index.js";
import { parseBirthDateIso } from "../model/birth-validation.js";

export function initBirthDateInput({ onApplyBirthDate, onUpdateHoverInfo }) {
  const dayInput = domRefs.birthDay;
  const monthInput = domRefs.birthMonth;
  const yearInput = domRefs.birthYear;
  const inputs = [dayInput, monthInput, yearInput];
  const hoverInfoEl = domRefs.hoverInfo;

  const setInvalidState = (isInvalid, errorMsg = "") => {
    inputs.forEach((input) => {
      input.classList.toggle("is-invalid", isInvalid);
      input.setAttribute("aria-invalid", String(isInvalid));
      if (isInvalid) {
        input.setAttribute("aria-describedby", "hover-info");
      } else {
        input.removeAttribute("aria-describedby");
      }
    });
    if (isInvalid) {
      hoverInfoEl.textContent = errorMsg;
    }
  };

  function validateAndCommitBirthInputs(fromBlurOrPaste = false) {
    const dStr = dayInput.value.trim();
    const mStr = monthInput.value.trim();
    const yStr = yearInput.value.trim();

    if (!dStr && !mStr && !yStr) {
      setInvalidState(false);
      hoverInfoEl.textContent = "";
      if (lifeState.birth) {
        storageRemove(STORAGE_KEYS.BIRTH);
        onApplyBirthDate(null);
      }
      return;
    }

    if (
      fromBlurOrPaste
        ? !dStr || !mStr || yStr.length !== 4
        : dStr.length < 2 || mStr.length < 2 || yStr.length !== 4
    ) {
      if (fromBlurOrPaste && !inputs.includes(document.activeElement)) {
        setInvalidState(true, "Complete your date of birth (DD / MM / YYYY)");
      } else {
        setInvalidState(false);
        onUpdateHoverInfo();
      }
      return;
    }

    if (+mStr < 1 || +mStr > 12) {
      setInvalidState(true, "Invalid month (1-12)");
      return;
    }

    if (+dStr < 1 || +dStr > daysInMonth(+yStr, +mStr - 1)) {
      setInvalidState(true, "Invalid date for this month");
      return;
    }

    const isoStr = `${yStr}-${pad2(mStr)}-${pad2(dStr)}`;
    const parsed = parseBirthDateIso(isoStr);
    if (parsed) {
      setInvalidState(false);
      if (
        lifeState.birth &&
        lifeState.birth.y === parsed.y &&
        lifeState.birth.m === parsed.m &&
        lifeState.birth.d === parsed.d
      ) {
        onUpdateHoverInfo();
      } else {
        storageSet(STORAGE_KEYS.BIRTH, isoStr);
        onApplyBirthDate(parsed);
      }
    } else {
      setInvalidState(true, "Enter a valid date between 1900 and today");
    }
  }

  const fieldSpecs = [
    { len: 2, adv: 3, next: monthInput },
    { len: 2, adv: 1, next: yearInput },
    { len: 4 },
  ];

  inputs.forEach((input, idx) => {
    const spec = fieldSpecs[idx];

    input.addEventListener("input", () => {
      let val = input.value.replace(/\D/g, "").slice(0, spec.len);
      if (spec.adv && val.length === 1 && +val > spec.adv) {
        val = "0" + val;
      }
      input.value = val;
      if (spec.next && val.length === spec.len) {
        spec.next.focus();
        spec.next.select();
      }
      validateAndCommitBirthInputs(false);
    });

    input.addEventListener("blur", () => {
      const trimmed = input.value.trim();
      if (spec.len === 2 && (trimmed === "0" || trimmed === "00")) {
        input.value = "";
      } else if (spec.len === 2 && trimmed.length === 1) {
        input.value = pad2(trimmed);
      }
      setTimeout(() => validateAndCommitBirthInputs(true), 0);
    });

    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Backspace" && !input.value && idx > 0) {
        evt.preventDefault();
        inputs[idx - 1].focus();
        inputs[idx - 1].select();
      } else if (evt.key === "Enter") {
        input.blur();
      }
    });

    input.addEventListener("focus", () => input.select());

    input.addEventListener("paste", (evt) => {
      const text = (evt.clipboardData?.getData("text") || "").trim();
      if (/^\d{8}$/.test(text)) {
        evt.preventDefault();
        const isYearFirst = +text.slice(0, 4) >= 1900;
        const [dPart, mPart, yPart] = isYearFirst
          ? [text.slice(6, 8), text.slice(4, 6), text.slice(0, 4)]
          : [text.slice(0, 2), text.slice(2, 4), text.slice(4, 8)];
        dayInput.value = pad2(dPart);
        monthInput.value = pad2(mPart);
        yearInput.value = yPart;
        input.blur();
        validateAndCommitBirthInputs(true);
        return;
      }
      const match = /^(\d{1,4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,4})$/.exec(text);
      if (!match) return;
      const [dPart, mPart, yPart] =
        match[1].length === 4
          ? [match[3], match[2], match[1]]
          : [match[1], match[2], match[3]];
      if (!(dPart.length > 2 || yPart.length !== 4)) {
        evt.preventDefault();
        dayInput.value = pad2(dPart);
        monthInput.value = pad2(mPart);
        yearInput.value = yPart;
        input.blur();
        validateAndCommitBirthInputs(true);
      }
    });
  });

  return {
    populateInputs(birthObj) {
      dayInput.value = pad2(birthObj.d);
      monthInput.value = pad2(birthObj.m + 1);
      yearInput.value = birthObj.y;
    },
    focusDayInputSoon() {
      setTimeout(() => dayInput.focus(), 80);
    },
  };
}
