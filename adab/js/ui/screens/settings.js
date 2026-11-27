// "کاريال جوړښت" and "د کاریال په اړه" (ui/settings/SettingsScreens.kt): the light / dark choice (kept on this phone),
// the report to the administrator, the About page and the last refresh time.

import { h } from '../dom.js';
import { S } from '../../strings.js';
import * as nav from '../nav.js';
import { VERSION } from '../../config.js';
import { pageFrame, refreshButton, syncLine } from '../widgets.js';
import { getTheme, setTheme } from '../theme.js';

export function settingsPage() {
  const refresh = refreshButton();
  const f = pageFrame({ title: S.settings_title, actions: [refresh] });
  const option = (value, label) => {
    const input = h('input', { type: 'radio', name: 'theme', value });
    input.checked = getTheme() === value;
    input.addEventListener('change', () => { if (input.checked) setTheme(value); });
    return h('label', { class: 'radio' }, input, h('span', null, label));
  };
  const line = syncLine();
  f.scroller.append(h('div', { class: 'content stack-16' },
    h('div', { class: 'panel', style: { padding: '8px 0' } },
      h('h2', { class: 'panel-head' }, S.theme_title),
      option('light', S.theme_light),
      option('dark', S.theme_dark),
    ),
    h('button', { class: 'panel panel-link', onclick: () => nav.go('/report') }, S.settings_report),
    h('button', { class: 'panel panel-link', onclick: () => nav.go('/about') }, S.about_title),
    line,
  ));
  return { el: f.el, scroller: f.scroller, destroy() { refresh.dispose(); line.dispose(); } };
}

export function aboutPage() {
  const f = pageFrame({ title: S.about_title });
  f.scroller.append(h('div', { class: 'content stack-16 about' },
    h('h2', { class: 't-headline-m bold', style: { color: 'var(--primary)', margin: 0 } }, S.app_name),
    S.about_text.split('\n\n').map((p) => h('p', { class: 't-body-l' }, p.trim())),
    h('p', { class: 't-body-s muted' }, S.version_label(VERSION)),
  ));
  return { el: f.el, scroller: f.scroller };
}
