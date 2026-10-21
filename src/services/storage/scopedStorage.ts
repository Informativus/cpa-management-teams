import { getPanelBasePath } from '@/utils/panelScope';

type PanelStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Namespacing prevents accidental credential reuse; backend authentication is
// still the security boundary. Same-origin scripts can access browser storage.
const scopeKey = (key: string): string => {
  const path = getPanelBasePath();
  return path ? `cpa:panel:${encodeURIComponent(path)}:${key}` : key;
};

const createScopedStorage = (storage: () => PanelStorage): PanelStorage => ({
  getItem: (key) => storage().getItem(scopeKey(key)),
  setItem: (key, value) => storage().setItem(scopeKey(key), value),
  removeItem: (key) => storage().removeItem(scopeKey(key)),
});

export const scopedLocalStorage = createScopedStorage(() => localStorage);
export const scopedSessionStorage = createScopedStorage(() => window.sessionStorage);
