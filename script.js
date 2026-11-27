/* Shabir Ahmad: portfolio behaviour. Plain JavaScript, no dependencies.
   Everything here is progressive enhancement: the page is fully readable without it. */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- Theme toggle (dark by default, choice is remembered) ---------- */
  var themeBtn = document.getElementById('theme-toggle');
  var metaTheme = document.querySelector('meta[name="theme-color"]');
  var THEME_COLOR = { dark: '#0e1430', light: '#eef0f5' };

  function applyTheme(theme, save) {
    root.setAttribute('data-theme', theme);
    if (metaTheme) { metaTheme.setAttribute('content', THEME_COLOR[theme]); }
    if (themeBtn) {
      themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    if (save) {
      try { localStorage.setItem('theme', theme); } catch (e) { /* storage unavailable */ }
    }
  }

  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
    });
  }

  /* ---------- Header: shadow on scroll + mobile menu ---------- */
  var header = document.querySelector('.site-header');
  var menuBtn = document.getElementById('menu-toggle');
  var nav = document.getElementById('primary-nav');

  function onScroll() {
    if (header) { header.classList.toggle('scrolled', window.scrollY > 8); }
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function setMenu(open) {
    if (!nav || !menuBtn) { return; }
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      setMenu(!nav.classList.contains('open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) { setMenu(false); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        setMenu(false);
        menuBtn.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('open') && header && !header.contains(e.target)) { setMenu(false); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 920) { setMenu(false); }
    });
  }

  /* ---------- Highlight the nav link of the section in view ---------- */
  var links = [].slice.call(document.querySelectorAll('.primary-nav a[href^="#"]'));
  var linkById = {};
  links.forEach(function (a) { linkById[a.getAttribute('href').slice(1)] = a; });

  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        links.forEach(function (a) {
          a.classList.remove('active');
          a.removeAttribute('aria-current');
        });
        var current = linkById[entry.target.id];
        if (current) {
          current.classList.add('active');
          current.setAttribute('aria-current', 'location');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    Object.keys(linkById).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) { spy.observe(section); }
    });
  }

  /* ---------- Pause the orbit animation while it is off-screen ---------- */
  var solar = document.getElementById('solar');
  if (solar && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      solar.classList.toggle('is-paused', !entries[0].isIntersecting);
    }).observe(solar);
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById('year');
  if (year) { year.textContent = String(new Date().getFullYear()); }
})();
