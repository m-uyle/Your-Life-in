export const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

export const pad2 = (val) => String(val).padStart(2, "0");

export const easeInOutCos = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
