const LIGHT_META = '#FAF8F5';
const DARK_META = '#1A1815';
const STORAGE_KEY = 'theme';

export function getThemeSetting() {
  return localStorage.getItem(STORAGE_KEY) || 'system';
}

export function setThemeSetting(setting) {
  localStorage.setItem(STORAGE_KEY, setting);
  applyTheme(setting);
}

export function applyTheme(setting) {
  const dark = setting === 'dark' ||
    (setting === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? DARK_META : LIGHT_META);
}

export function initThemeListener() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function onChange() {
    if (getThemeSetting() === 'system') {
      applyTheme('system');
    }
  }
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
