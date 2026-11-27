// The page stack, like the Android back stack: going to a page puts it on top (the pages under it stay as they were,
// scroll position and search text included); going back removes the top page and shows the one under it.
// Every page has its own entry in the browser history, so the browser's back gesture or button also works.

const routes = [];
const stack = [];
let app;

/** Registers a page: pattern like '/read/:slug/:letter'; make(params, query) returns a page object. */
export function route(pattern, make) {
  const names = [];
  const re = new RegExp('^' + pattern.replace(/:[a-z]+/g, (m) => { names.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ re, names, make });
}

function create(path) {
  const [p, q] = path.split('?');
  const query = new URLSearchParams(q || '');
  for (const r of routes) {
    const m = r.re.exec(p);
    if (m) {
      const params = {};
      r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      const page = r.make(params, query);
      page.path = path;
      return page;
    }
  }
  return null;
}

export function top() {
  return stack[stack.length - 1] || null;
}

export function pages() {
  return stack.slice();
}

function hide(page) {
  if (!page) return;
  if (page.scroller) page.savedScroll = page.scroller.scrollTop;
  page.el.classList.add('is-hidden');
  page.el.setAttribute('aria-hidden', 'true');
  if (page.onHide) page.onHide();
}

function show(page) {
  if (!page) return;
  page.el.classList.remove('is-hidden', 'enter');
  page.el.removeAttribute('aria-hidden');
  if (page.onShow) page.onShow();
  if (page.scroller && page.savedScroll != null) page.scroller.scrollTop = page.savedScroll;
}

function mount(page, animate) {
  if (animate) page.el.classList.add('enter');
  app.append(page.el);
  if (page.onShow) page.onShow();
}

export function start(container, path = '/') {
  app = container;
  const page = create(path) || create('/');
  stack.push(page);
  history.replaceState({ depth: 1 }, '', '#' + page.path);
  mount(page, false);
  window.addEventListener('popstate', onPop);
}

export function go(path) {
  const page = create(path);
  if (!page) return;
  hide(top());
  stack.push(page);
  history.pushState({ depth: stack.length }, '', '#' + path);
  mount(page, true);
}

export function back() {
  if (stack.length > 1) history.back();
}

function onPop(event) {
  const depth = (event.state && event.state.depth) || 1;
  if (depth < stack.length) {
    while (stack.length > Math.max(depth, 1)) {
      const page = stack.pop();
      if (page.destroy) page.destroy();
      page.el.remove();
    }
    show(top());
  } else if (depth > stack.length) {
    // Forward again (a browser button): rebuild the page from the address.
    const page = create(location.hash.slice(1) || '/');
    if (!page) return;
    hide(top());
    stack.push(page);
    mount(page, true);
  }
}
