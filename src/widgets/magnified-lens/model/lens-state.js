export const lensState = {
  spec: null,
  key: null,
  curHM: -1,
  win: { start: -1, total: 0 },
  dirty: true,
  m: null,
  cascadeElems: [],
  layoutTotal: 0,
  box: null,
  cachedW: 0,
  cachedH: 0,
  cachedFunnelH: 22,
  cachedTargetTitle: "",
  boardCapH: "",
  kbIdx: -1,
  touchActive: false,
  base: null,
};

export const lensSelectionBox = document.createElement("div");
