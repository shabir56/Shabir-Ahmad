// Start of the web app: the opening scene, the phone's copy of the data, the pages, and one refresh from the server.

import { applyTheme } from './ui/theme.js';
import * as store from './data/store.js';
import * as nav from './ui/nav.js';
import { playIntro } from './ui/intro.js';
import { preloadShareAssets } from './ui/share.js';
import { homePage } from './ui/screens/home.js';
import { genreChoicePage, genrePage, letterPage } from './ui/screens/read.js';
import { favoritesPage } from './ui/screens/favorites.js';
import { contributePage, reportPage } from './ui/screens/forms.js';
import { notificationsPage, notificationPage } from './ui/screens/notifications.js';
import { settingsPage, aboutPage } from './ui/screens/settings.js';

const SIX_HOURS = 6 * 60 * 60 * 1000;

nav.route('/', () => homePage());
nav.route('/read', () => genreChoicePage('read'));
nav.route('/read/:slug', (p) => genrePage(p.slug));
nav.route('/read/:slug/:letter', (p, q) => letterPage(p.slug, Number(p.letter) || 0, q.get('resume') === '1'));
nav.route('/write', () => genreChoicePage('write'));
nav.route('/write/:slug', (p) => contributePage(p.slug));
nav.route('/fav', () => favoritesPage());
nav.route('/notifs', () => notificationsPage());
nav.route('/notif/:id', (p) => notificationPage(p.id));
nav.route('/settings', () => settingsPage());
nav.route('/about', () => aboutPage());
nav.route('/report', () => reportPage());

function quietSync() {
  store.syncNow().catch(() => { /* offline: the phone's copy stays */ });
}

async function boot() {
  const intro = playIntro();
  await store.load();
  applyTheme();
  // The home page is built under the opening scene, so it is there when the scene fades out.
  nav.start(document.getElementById('app'), '/');
  document.body.classList.remove('booting');
  preloadShareAssets();
  // The one refresh at app start. Nothing else refreshes by itself, except coming back after six hours.
  quietSync();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (!store.sync.lastSyncAt || Date.now() - store.sync.lastSyncAt > SIX_HOURS)) quietSync();
  });
  await intro;
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* works without it, only not offline */ });
}

boot();
