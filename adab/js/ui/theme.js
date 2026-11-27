// Light / dark (data/repo/SettingsRepository.kt): light until the reader chooses dark, whatever the phone's own
// setting is; the choice is kept on this phone.

const KEY = 'theme_mode';
const BARS = { light: '#FAF5E9', dark: '#121A16' };

export function getTheme() {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

export function applyTheme(mode = getTheme()) {
  document.documentElement.dataset.theme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BARS[mode]);
}

export function setTheme(mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch (e) {
    // private mode: the choice lasts for this visit
  }
  applyTheme(mode);
}
