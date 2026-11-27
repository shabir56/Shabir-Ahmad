// "خبرتیاوې" (ui/notifications/NotificationsScreens.kt): the administrator's publications as the user's own list.
// Deleting one or clearing the list only hides them on THIS phone; the server is never touched. The web version has
// no push messages: the list is brought up to date whenever it is opened (and with every refresh).

import { h, icon, clear, formatMillis } from '../dom.js';
import { S } from '../../strings.js';
import * as nav from '../nav.js';
import * as store from '../../data/store.js';
import { pageFrame, refreshButton, emptyState, snackbar, confirmDialog } from '../widgets.js';

export function notificationsPage() {
  const clearAll = h('button', { class: 'icon-btn', 'aria-label': S.notif_clear_all }, icon('delete'));
  const refresh = refreshButton();
  const f = pageFrame({ title: S.notif_title, actions: [clearAll, refresh] });

  const render = () => {
    const list = store.visibleNotifications();
    clearAll.hidden = list.length === 0;
    const y = f.scroller.scrollTop;
    clear(f.scroller);
    if (list.length === 0) {
      f.scroller.append(emptyState(S.notif_empty));
      return;
    }
    f.scroller.append(h('div', { class: 'content cards' }, list.map((n) => {
      const del = h('button', { class: 'icon-btn', 'aria-label': S.notif_delete }, icon('delete'));
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        store.dismiss(n.id);
        snackbar(S.notif_deleted);
      });
      return h('div', { class: `notif-row${n.isRead ? '' : ' unread'}`, role: 'button', tabindex: '0', onclick: () => nav.go(`/notif/${encodeURIComponent(n.id)}`) },
        n.isRead ? null : h('span', { class: 'notif-dot' }),
        h('div', { class: 'notif-body' },
          h('div', { class: 'notif-title' }, n.title),
          n.message.trim() ? h('div', { class: 'notif-msg' }, n.message) : null,
          h('div', { class: 'notif-time' }, formatMillis(n.createdAtMs)),
        ),
        del,
      );
    })));
    f.scroller.scrollTop = y;
  };

  clearAll.addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: S.notif_clear_title, message: S.notif_clear_message, confirm: S.notif_clear_all, danger: true,
    });
    if (yes) { store.dismissAll(); snackbar(S.notif_cleared); }
  });

  render();
  const off = store.on('inbox', render);
  // Bring the list up to date every time the page opens (quietly: offline simply keeps what is on the phone).
  store.syncNotificationsQuietly();

  return { el: f.el, scroller: f.scroller, onShow: render, destroy() { off(); refresh.dispose(); } };
}

export function notificationPage(id) {
  const f = pageFrame({ title: S.notif_title });
  const n = store.notification(id);
  if (!n) {
    f.scroller.append(emptyState(S.notif_missing));
  } else {
    // Opening the details is what makes it "read" (the number on the bell counts down).
    store.markRead(id);
    f.scroller.append(h('div', { class: 'content stack-16' },
      h('div', { class: 'selectable stack-16' },
        h('h2', { class: 'notif-detail-title' }, n.title),
        n.message.trim() ? h('p', { class: 'notif-detail-msg t-body-l' }, n.message) : null,
      ),
      h('div', { class: 't-body-s muted', style: { direction: 'ltr', textAlign: 'right' } }, formatMillis(n.createdAtMs)),
      h('button', {
        class: 'btn btn-outlined btn-wide',
        onclick: () => { store.dismiss(id); nav.back(); },
      }, S.notif_delete),
    ));
  }
  return { el: f.el, scroller: f.scroller };
}
