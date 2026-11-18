export const storageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const storageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

export const storageRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {}
};
