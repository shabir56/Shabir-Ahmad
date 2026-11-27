// Writing to the server: a contribution (ui/contribute/ContributeScreen.kt) and a report to the administrator
// (ui/settings/ReportScreen.kt). Both are sent only while online and exist only after the server confirmed them:
// nothing is queued on the phone. The draft keeps its text on an error; its id is made once and reused for a retry,
// so pressing "send" twice can never create two rows. A new id is made only after the server confirmed one.

import { h, icon, clear } from '../dom.js';
import { S } from '../../strings.js';
import * as nav from '../nav.js';
import * as api from '../../data/api.js';
import { genreBySlug } from '../../core/content.js';
import { validate, Result, isBlank } from '../../core/validator.js';
import { VERSION } from '../../config.js';
import { pageFrame, isOnline, onOnlineChange, uuid } from '../widgets.js';
import { genreChoicePage } from './read.js';

const MAX_REPORT_LENGTH = 2000;

function successPanel(text, againLabel, onAgain) {
  return h('div', { class: 'success' },
    h('div', { class: 'success-mark', 'aria-label': S.check_done }, icon('check')),
    h('h2', { class: 't-headline-s' }, text),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-filled', onclick: onAgain }, againLabel),
      h('button', { class: 'btn btn-outlined', onclick: () => nav.back() }, S.back),
    ),
  );
}

function sendButton(label, sendingLabel) {
  const btn = h('button', { class: 'btn btn-filled btn-wide btn-56' });
  btn.paint = (sending) => {
    clear(btn);
    if (sending) btn.append(h('span', { class: 'spinner' }), h('span', { class: 't-body-m' }, sendingLabel));
    else btn.append(h('span', { class: 't-title-l' }, label));
  };
  btn.paint(false);
  return btn;
}

/** "وليکه": a new tappa / kakṛai ghaṛai for the administrator to check. */
export function contributePage(slug) {
  const genre = genreBySlug(slug);
  if (!genre) return genreChoicePage('write');
  const f = pageFrame({ title: genre.title });
  const banner = h('div', { class: 'banner' }, S.offline_required_submit);
  f.el.insertBefore(banner, f.scroller);

  let draftId = uuid();
  let sending = false;

  const textarea = h('textarea', { class: 'field lit', rows: '8', placeholder: S.contribute_hint, dir: 'rtl', style: { height: '320px' } });
  const error = h('div', { class: 'error-text', hidden: true });
  const send = sendButton(S.contribute_submit, S.contribute_sending);
  const form = h('div', { class: 'content stack-12' },
    h('p', { class: 't-body-m muted', style: { margin: 0 } }, S.contribute_note),
    textarea, error, send,
  );

  const paint = () => {
    banner.hidden = isOnline();
    send.disabled = !isOnline() || sending || isBlank(textarea.value);
    textarea.disabled = sending;
  };
  const showError = (text) => {
    error.textContent = text || '';
    error.hidden = !text;
    textarea.classList.toggle('error', !!text);
  };

  textarea.addEventListener('input', () => { if (!error.hidden) showError(null); paint(); });
  send.addEventListener('click', async () => {
    if (sending) return;
    if (!isOnline()) { showError(S.offline_required_submit); return; }
    const problem = {
      [Result.EMPTY]: S.err_empty, [Result.TOO_LONG]: S.err_too_long, [Result.NOT_PASHTO_SCRIPT]: S.err_not_pashto,
    }[validate(textarea.value)];
    if (problem) { showError(problem); return; }
    sending = true;
    send.paint(true);
    paint();
    try {
      await api.submitContribution(draftId, genre.id, textarea.value);
      // Only now has the server confirmed the contribution.
      textarea.value = '';
      draftId = uuid();
      clear(f.scroller).append(successPanel(S.contribute_success, S.contribute_another, () => {
        clear(f.scroller).append(form);
        paint();
      }));
    } catch (e) {
      showError(S.err_submit_failed);
    } finally {
      sending = false;
      send.paint(false);
      paint();
    }
  });

  f.scroller.append(form);
  paint();
  const off = onOnlineChange(paint);
  return { el: f.el, scroller: f.scroller, destroy: off };
}

/** "مدير ته راپور وليکه": a wrong tappa / kakṛai ghaṛai, a problem of the app, or another message. */
export function reportPage() {
  const f = pageFrame({ title: S.report_title });
  const banner = h('div', { class: 'banner' }, S.offline_required_submit);
  f.el.insertBefore(banner, f.scroller);

  let draftId = uuid();
  let sending = false;
  let kind = 'wrong_text';

  const radios = [
    ['wrong_text', S.report_kind_wrong_text],
    ['app_problem', S.report_kind_app_problem],
    ['other', S.report_kind_other],
  ].map(([key, label]) => {
    const input = h('input', { type: 'radio', name: 'report-kind', value: key });
    if (key === kind) input.checked = true;
    input.addEventListener('change', () => { if (input.checked && !sending) kind = key; });
    return h('label', { class: 'radio' }, input, h('span', null, label));
  });

  const textarea = h('textarea', { class: 'field lit', placeholder: S.report_hint, dir: 'rtl', maxlength: String(MAX_REPORT_LENGTH), style: { height: '240px' } });
  const counter = h('div', { class: 'counter' });
  const error = h('div', { class: 'error-text', hidden: true });
  const send = sendButton(S.report_submit, S.report_sending);
  const form = h('div', { class: 'content stack-12' },
    h('p', { class: 't-body-m muted', style: { margin: 0 } }, S.report_note),
    h('div', null, radios),
    h('div', null, textarea, counter),
    error, send,
  );

  const paint = () => {
    banner.hidden = isOnline();
    send.disabled = !isOnline() || sending || isBlank(textarea.value);
    textarea.disabled = sending;
    counter.textContent = `${textarea.value.length} / ${MAX_REPORT_LENGTH}`;
  };
  const showError = (text) => {
    error.textContent = text || '';
    error.hidden = !text;
    textarea.classList.toggle('error', !!text);
  };

  textarea.addEventListener('input', () => {
    if (textarea.value.length > MAX_REPORT_LENGTH) textarea.value = textarea.value.slice(0, MAX_REPORT_LENGTH);
    if (!error.hidden) showError(null);
    paint();
  });
  send.addEventListener('click', async () => {
    if (sending) return;
    if (!isOnline()) { showError(S.offline_required_submit); return; }
    if (isBlank(textarea.value)) { showError(S.err_empty); return; }
    sending = true;
    send.paint(true);
    paint();
    try {
      await api.submitReport(draftId, kind, textarea.value.trim(), `web-${VERSION}`);
      textarea.value = '';
      draftId = uuid();
      clear(f.scroller).append(successPanel(S.report_success, S.report_title, () => {
        clear(f.scroller).append(form);
        paint();
      }));
    } catch (e) {
      showError(S.err_submit_failed);
    } finally {
      sending = false;
      send.paint(false);
      paint();
    }
  });

  f.scroller.append(form);
  paint();
  const off = onOnlineChange(paint);
  return { el: f.el, scroller: f.scroller, destroy: off };
}
