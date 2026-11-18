import { daysInMonth, makeLocalTime } from "../../../shared/lib/date/index.js";

export const parseBirthDateIso = (isoStr) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoStr || "");
  if (!match) return null;
  const y = +match[1];
  const m = +match[2] - 1;
  const d = +match[3];
  return y >= 1900 &&
    m >= 0 &&
    m <= 11 &&
    d >= 1 &&
    d <= daysInMonth(y, m) &&
    makeLocalTime(y, m, d) <= Date.now()
    ? { y, m, d }
    : null;
};
