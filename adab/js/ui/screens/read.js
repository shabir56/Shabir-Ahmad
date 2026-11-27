// Reading (ui/read/ReadScreens.kt): the genre choice, the genre page (the "نوبت" button, introduction, search and the
// alphabet) and the list of one letter. Everything is read from the phone's copy; the network only fills it.

import { h, icon, clear } from '../dom.js';
import { S } from '../../strings.js';
import * as nav from '../nav.js';
import * as store from '../../data/store.js';
import { GENRES, genreBySlug } from '../../core/content.js';
import { LETTERS, canonical, display, position } from '../../core/alphabet.js';
import * as Search from '../../core/search.js';
import * as Stanzas from '../../core/stanzas.js';
import { pageFrame, refreshButton, syncLine, stanzaCard, lazyList, emptyState, snackbar } from '../widgets.js';

/** Page 2, also the genre step of contributing: "ژانر وټاکه". */
export function genreChoicePage(target) {
  const refresh = refreshButton();
  const f = pageFrame({ title: S.select_genre, actions: [refresh] });
  f.scroller.append(h('div', { class: 'genre-choice' },
    GENRES.map((g) => h('button', { class: 'genre-btn', onclick: () => nav.go(`/${target}/${g.slug}`) }, g.title)),
  ));
  return { el: f.el, scroller: f.scroller, destroy() { refresh.dispose(); } };
}

/**
 * Page 3: "نوبت", the genre introduction, the sync line, the search box and the alphabet. While something is typed,
 * the introduction and the alphabet give way to the matching stanzas of ALL letters (best matches first).
 */
export function genrePage(slug) {
  const genre = genreBySlug(slug);
  if (!genre) return genreChoicePage('read');
  const refresh = refreshButton();
  const f = pageFrame({ title: genre.title, actions: [refresh] });
  const line = syncLine();

  let query = '';
  let stanzas = [];
  let comparing = [];
  let list = null;

  const load = () => {
    stanzas = Stanzas.of(store.entriesOfGenre(slug));
    comparing = stanzas.map((s) => Search.normalize(s.text));
  };
  load();

  const resumeBtn = h('button', { class: 'btn btn-tonal resume-btn' }, icon('history'), S.resume_title);
  const paintResume = () => resumeBtn.classList.toggle('dim', !store.getResume(slug));
  resumeBtn.addEventListener('click', () => {
    const saved = store.getResume(slug);
    if (!saved) { snackbar(S.resume_none); return; }
    const found = stanzas.find((s) => s.text === saved.body);
    const letterIndex = LETTERS.indexOf(canonical(found ? found.letter : saved.letter));
    if (found && letterIndex >= 0) nav.go(`/read/${slug}/${letterIndex}?resume=1`);
    else if (stanzas.length === 0 && letterIndex >= 0) nav.go(`/read/${slug}/${letterIndex}?resume=1`);
    else { store.clearResume(slug); snackbar(S.resume_missing); }
  });

  const intro = h('p', { class: 'intro-card t-body-l' }, genre.introduction);

  const input = h('input', {
    type: 'search', enterkeyhint: 'search', placeholder: S.search_hint, autocomplete: 'off',
    autocorrect: 'off', spellcheck: 'false', dir: 'rtl', 'aria-label': S.search_hint,
  });
  const clearBtn = h('button', { class: 'icon-btn', 'aria-label': S.search_clear, hidden: true }, icon('close'));
  const field = h('label', { class: 'search-field' }, icon('search'), input, clearBtn);

  const lower = h('div', { class: 'genre-lower' });
  const body = h('div', { class: 'content genre-page' }, resumeBtn, intro, line, field, lower);
  f.scroller.append(body);

  const renderLetters = () => {
    const counts = store.letterCounts(slug);
    clear(lower).append(
      h('h2', { class: 'section-title' }, S.alphabet_title),
      h('div', { class: 'letters', style: { marginTop: '10px' } },
        LETTERS.map((letter, i) => h('button', {
          class: `letter-chip${(counts.get(letter) || 0) > 0 ? ' has' : ''}`,
          onclick: () => nav.go(`/read/${slug}/${i}`),
        }, display(letter))),
      ),
    );
  };

  const renderResults = () => {
    if (list) { list.dispose(); list = null; }
    const words = Search.words(query);
    const results = stanzas
      .map((s, i) => [s, i])
      .filter(([, i]) => Search.matchesNormalized(comparing[i], words))
      .map(([s, i]) => [s, Search.rankNormalized(comparing[i], words)])
      .sort((a, b) => (a[1] - b[1]) || (position(a[0].letter) - position(b[0].letter)))
      .map(([s]) => s);
    const cards = h('div', { class: 'cards', style: { marginTop: '10px' } });
    clear(lower).append(
      h('div', { class: 'result-count' }, results.length ? S.search_count(results.length) : S.search_none),
      cards,
    );
    list = lazyList(cards, f.scroller, results, (s) => stanzaCard({ text: s.text, slug, letter: s.letter, highlightWords: words }));
  };

  const render = () => {
    const searching = Search.words(query).length > 0;
    intro.hidden = searching;
    clearBtn.hidden = query.length === 0;
    if (searching) renderResults();
    else { if (list) { list.dispose(); list = null; } renderLetters(); }
  };

  let timer = 0;
  input.addEventListener('input', () => {
    query = input.value;
    clearBtn.hidden = query.length === 0;
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    input.value = '';
    query = '';
    render();
    input.focus();
  });

  paintResume();
  render();

  const offEntries = store.on('entries', () => {
    load();
    if (nav.top() === page) { const y = f.scroller.scrollTop; render(); f.scroller.scrollTop = y; } else page.dirty = true;
  });
  const offMarks = store.on('marks', (d) => { if (d.slug === slug) paintResume(); });

  const page = {
    el: f.el,
    scroller: f.scroller,
    onShow() {
      paintResume();
      if (page.dirty) { page.dirty = false; render(); } else if (Search.words(query).length === 0) renderLetters();
    },
    destroy() { refresh.dispose(); line.dispose(); offEntries(); offMarks(); if (list) list.dispose(); clearTimeout(timer); },
  };
  return page;
}

/**
 * Page 4: every tappa / kakṛai ghaṛai of one letter, each in its own card. Coming from "نوبت" (resume=1) the list is
 * scrolled once so the saved stanza is the first card on the screen.
 */
export function letterPage(slug, letterIndex, jumpToResume) {
  const genre = genreBySlug(slug);
  if (!genre) return genreChoicePage('read');
  const letter = LETTERS[letterIndex] || LETTERS[0];
  const refresh = refreshButton();
  const f = pageFrame({ title: S.list_title(genre.title, display(letter)), actions: [refresh] });
  let list = null;

  const render = () => {
    if (list) { list.dispose(); list = null; }
    const stanzas = Stanzas.of(store.entriesOf(slug, letter));
    clear(f.scroller);
    if (stanzas.length === 0) {
      f.scroller.append(emptyState(S.letter_empty));
      return stanzas;
    }
    const cards = h('div', { class: 'cards' });
    f.scroller.append(h('div', { class: 'content' }, cards));
    list = lazyList(cards, f.scroller, stanzas, (s) => stanzaCard({ text: s.text, slug, letter: s.letter }));
    return stanzas;
  };

  let jumped = false;
  const jump = (stanzas) => {
    if (!jumpToResume || jumped || stanzas.length === 0) return;
    jumped = true;
    const saved = store.getResume(slug);
    const at = stanzas.findIndex((s) => saved && s.text === saved.body);
    if (at < 0) return;
    const node = list && list.ensure(at);
    if (!node) return;
    requestAnimationFrame(() => {
      const delta = node.getBoundingClientRect().top - f.scroller.getBoundingClientRect().top;
      f.scroller.scrollTop = Math.max(0, f.scroller.scrollTop + delta - 8);
    });
  };
  jump(render());

  const offEntries = store.on('entries', () => {
    if (nav.top() === page) { const y = f.scroller.scrollTop; jump(render()); f.scroller.scrollTop = y; } else page.dirty = true;
  });

  const page = {
    el: f.el,
    scroller: f.scroller,
    onShow() { if (page.dirty) { page.dirty = false; const y = f.scroller.scrollTop; render(); f.scroller.scrollTop = y; } },
    destroy() { refresh.dispose(); offEntries(); if (list) list.dispose(); },
  };
  return page;
}
