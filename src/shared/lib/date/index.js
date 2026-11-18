export const scratchDate = new Date();

export const daysInMonth = (year, monthIdx) =>
  monthIdx === 1
    ? (year & 3) || (year % 100 === 0 && year % 400 !== 0)
      ? 28
      : 29
    : 31 - ((monthIdx % 7) & 1);

export const makeLocalTime = (year, monthIdx, day) => +new Date(year, monthIdx, day);

export const addDays = (timestamp, daysOffset) => (
  scratchDate.setTime(timestamp),
  +new Date(
    scratchDate.getFullYear(),
    scratchDate.getMonth(),
    scratchDate.getDate() + daysOffset
  )
);

export const toUtcMidnight = (timestamp) => (
  scratchDate.setTime(timestamp),
  Date.UTC(
    scratchDate.getFullYear(),
    scratchDate.getMonth(),
    scratchDate.getDate()
  )
);

export const diffDays = (startMs, endMs) =>
  Math.round((toUtcMidnight(endMs) - toUtcMidnight(startMs)) / 864e5);

export const numberFormatter = new Intl.NumberFormat("en-US");

const baseDateTimeOpts = {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const dateFormatters = {
  default: new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
  dmyShort: new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  hm: new Intl.DateTimeFormat("en-GB", baseDateTimeOpts),
  hms: new Intl.DateTimeFormat("en-GB", {
    ...baseDateTimeOpts,
    second: "2-digit",
  }),
};

export const formatDate = (timestamp, mode = "default") =>
  dateFormatters[mode].format(timestamp);

export const getCellStatus = (nowMs, startMs, endMs) =>
  nowMs >= endMs ? "lived" : nowMs >= startMs ? "current" : "future";
