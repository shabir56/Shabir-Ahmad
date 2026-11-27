// "خوښ شوي" (ui/favorites/FavoritesScreen.kt): the stanzas the reader marked with the heart, one page per genre,
// newest first. The two genres are two pages side by side: swipe left / right between them, or tap a tab. A tap on a
// filled heart removes the favorite and offers "بېرته" (undo). Everything is on this phone only.

import { h, clear } from '../dom.js';
import { S } from '../../strings.js';
import * as store from '../../data/store.js';
import { GENRES } from '../../core/content.js';
import { pageFrame, stanzaCard, lazyList, emptyState, snackbar } from '../widgets.js';

export function favoritesPage() {
  const f = pageFrame({ title: S.favorites_title });
  // The tabs and the pager replace the plain scroller of the frame.
  f.scroller.remove();
  const tabs = GENRES.map((g, i) => h('button', { class: 'tab', role: 'tab', onclick: () => select(i, true) }));
  const indicator = h('div', { class: 'tab-indicator' });
  const tabRow = h('div', { class: 'tabs', role: 'tablist' }, tabs, indicator);
  const panels = GENRES.map(() => h('div', { class: 'pager-page', role: 'tabpanel' }));
  const pager = h('div', { class: 'pager' }, panels);
  f.el.append(tabRow, pager);

  let current = 0;
  const lists = [];

  const paintTabs = () => {
    GENRES.forEach((g, i) => {
      tabs[i].textContent = `${g.title} (${store.favoriteCount(g.slug)})`;
      tabs[i].classList.toggle('on', i === current);
      tabs[i].setAttribute('aria-selected', String(i === current));
    });
    const w = tabRow.clientWidth / GENRES.length;
    indicator.style.width = `${Math.max(0, w - 32)}px`;
    indicator.style.right = `${current * w + 16}px`;
  };

  const removeWithUndo = (fav) => {
    store.setFavorite(fav.slug, fav.body, fav.letter, false);
    snackbar(S.favorite_removed, S.undo).then((undo) => {
      // Back at the same place in the list: the old save time is kept.
      if (undo) store.setFavorite(fav.slug, fav.body, fav.letter, true, fav.savedAt);
    });
  };

  const renderPanel = (i) => {
    const slug = GENRES[i].slug;
    const panel = panels[i];
    const y = panel.scrollTop;
    if (lists[i]) lists[i].dispose();
    lists[i] = null;
    clear(panel);
    const favs = store.favoritesOf(slug);
    if (favs.length === 0) {
      panel.append(emptyState(S.favorites_empty));
      return;
    }
    const cards = h('div', { class: 'cards' });
    panel.append(h('div', { class: 'content' }, cards));
    lists[i] = lazyList(cards, panel, favs, (fav) => stanzaCard({
      text: fav.body, slug: fav.slug, letter: fav.letter, resume: false, onHeart: () => removeWithUndo(fav),
    }));
    panel.scrollTop = y;
  };

  const select = (i, animate) => {
    current = i;
    paintTabs();
    const width = pager.clientWidth;
    // Right-to-left: the first genre is on the right, the second comes with a swipe to the left.
    pager.scrollTo({ left: -i * width, behavior: animate ? 'smooth' : 'auto' });
  };

  pager.addEventListener('scroll', () => {
    const width = pager.clientWidth || 1;
    const i = Math.min(GENRES.length - 1, Math.max(0, Math.round(Math.abs(pager.scrollLeft) / width)));
    if (i !== current) { current = i; paintTabs(); }
  }, { passive: true });
  window.addEventListener('resize', paintTabs);

  GENRES.forEach((g, i) => renderPanel(i));
  const offMarks = store.on('marks', ({ slug }) => {
    const i = GENRES.findIndex((g) => g.slug === slug);
    if (i >= 0) renderPanel(i);
    paintTabs();
  });

  return {
    el: f.el,
    scroller: null,
    onShow() { requestAnimationFrame(paintTabs); },
    destroy() { offMarks(); window.removeEventListener('resize', paintTabs); lists.forEach((l) => l && l.dispose()); },
  };
}
