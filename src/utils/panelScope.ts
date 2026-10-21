/** The directory hosting the single-file panel is also its API mount point. */
export const getPanelBasePath = (): string => {
  if (typeof window === 'undefined' || !window.location) return '';
  return (window.location.pathname || '').replace(/\/[^/]*\.html?$/i, '').replace(/\/+$/, '');
};
