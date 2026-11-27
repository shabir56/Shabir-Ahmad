// The home page (ui/home/HomeScreen.kt): settings in one top corner, the notification bell with the number of unread
// notifications in the other, the silent rubab hanging from its nail, the title and the three main buttons.
// The administration corner of the Android app is not here: the administrator works in the Android app.

import { h, icon, rich } from '../dom.js';
import { S } from '../../strings.js';
import * as nav from '../nav.js';
import * as store from '../../data/store.js';
import { hangingRubab, CORD } from '../rubab.js';

const HINT_KEY = 'install_hint_hidden_at';

function isStandalone() {
  return window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

function isIos() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** The "add to Home Screen" hint, only in an iPhone browser (not once the app is on the Home Screen). */
function installHint() {
  if (isStandalone() || !isIos()) return null;
  let hiddenAt = 0;
  try { hiddenAt = Number(sessionStorage.getItem(HINT_KEY)) || 0; } catch (e) { /* private mode */ }
  if (hiddenAt) return null;
  const card = h('div', { class: 'install-card', role: 'note' },
    h('p', null, rich(S.install_hint, { share: icon('iosShare', 'ios-share') })),
    h('button', {
      class: 'icon-btn', 'aria-label': S.install_hint_close,
      onclick: () => { try { sessionStorage.setItem(HINT_KEY, String(Date.now())); } catch (e) { /* */ } card.remove(); },
    }, icon('close')),
  );
  return card;
}

export function homePage() {
  const badge = h('span', { class: 'badge', hidden: true });
  const bell = h('button', { class: 'icon-btn home-bell', 'aria-label': S.home_notifications, onclick: () => nav.go('/notifs') }, icon('bell'), badge);
  const paintBadge = () => {
    const n = store.unreadCount();
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? '99+' : String(n);
  };
  paintBadge();

  const settings = h('button', { class: 'btn btn-text home-settings', onclick: () => nav.go('/settings') }, icon('settings'), S.home_settings);
  const top = h('div', { class: 'home-top' }, settings, bell);

  // The rubab takes about a third of the page height, whatever the screen (a little less while the install hint shows).
  const hint = installHint();
  const share = hint ? 0.22 : 0.30;
  const rubabHeight = Math.round(Math.min(320, Math.max(hint ? 140 : 170, window.innerHeight * share)));
  const rubab = hangingRubab(rubabHeight);
  const hangingRoom = CORD + rubabHeight + 8;

  const main = h('div', { class: 'home-main' },
    h('h1', { class: 'home-title t-display-s' }, S.app_name),
    h('div', { class: 'home-rule' }),
    h('p', { class: 'home-tagline t-body-l' }, S.home_tagline),
    h('button', { class: 'btn btn-filled home-btn', onclick: () => nav.go('/read') }, S.home_read),
    h('button', { class: 'btn btn-tonal home-btn', onclick: () => nav.go('/write') }, S.home_contribute),
    h('button', { class: 'btn btn-outlined home-btn', onclick: () => nav.go('/fav') }, icon('heart'), S.home_favorites),
  );
  const body = h('div', { class: 'home-body' }, main);
  const el = h('section', { class: 'page home' },
    top,
    h('div', { style: { flex: 'none', height: `${hangingRoom}px` } }),
    body,
    hint ? h('div', { class: 'home-foot' }, hint) : h('div', { style: { height: 'var(--safe-bottom)', flex: 'none' } }),
    rubab.el,
  );

  const offInbox = store.on('inbox', paintBadge);
  const onVisibility = () => { if (document.hidden) rubab.stop(); else if (nav.top() === page) rubab.start(); };
  document.addEventListener('visibilitychange', onVisibility);

  const page = {
    el,
    scroller: body,
    onShow() { paintBadge(); rubab.start(); },
    onHide() { rubab.stop(); },
    destroy() { offInbox(); rubab.stop(); document.removeEventListener('visibilitychange', onVisibility); },
  };
  return page;
}
