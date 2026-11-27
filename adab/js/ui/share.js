// Shares ONE tappa / kakṛai ghaṛai as a picture card (the owner's design "B"), drawn on the phone exactly like
// share/StanzaSharer.kt of the Android app: dark green ground, the rabab faint behind the verse, a double gold frame,
// the genre name, the verse, and the app name with its small icon. Nothing is sent to a server.
//
// The picture goes to the phone's share sheet (WhatsApp, ...). The drawing is done synchronously inside the tap, so
// iPhone Safari still counts the share as started by the reader. Where a browser cannot share files, the picture is
// shown full screen to be saved with a long press.

import * as Card from '../core/sharecard.js';
import { S } from '../strings.js';
import { h, rich } from './dom.js';

const GROUND_CENTER = '#1E2D26';
const GROUND_EDGE = '#121A16';
const GOLD = '#E2C56F';
const GOLD_STRONG = 'rgba(226, 197, 111, 0.75)';
const GOLD_SOFT = 'rgba(226, 197, 111, 0.30)';
const PAPER = '#E8E2D4';
const LABEL_LINE = 83;
const FONT = "'Naskh', 'Noto Naskh Arabic', serif";

const images = {};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Loads the pictures and fonts of the card ahead, so that a tap can draw at once. */
export async function preloadShareAssets() {
  const [rubab, icon] = await Promise.all([loadImage('assets/img/rubab.webp'), loadImage('assets/img/icon-small.png')]);
  images.rubab = rubab;
  images.icon = icon;
  try {
    await Promise.all([document.fonts.load(`64px ${FONT}`, 'ټپه'), document.fonts.load(`bold 52px ${FONT}`, 'ټپه')]);
  } catch (e) {
    // the card then uses the phone's own Arabic font
  }
}

function baseline(ctx, centre) {
  const m = ctx.measureText('ټپهی');
  if (m.fontBoundingBoxAscent !== undefined && m.fontBoundingBoxDescent !== undefined) {
    return centre + (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
  }
  return centre + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
}

function roundRect(ctx, x0, y0, x1, y1, r) {
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x1 - r, y0);
  ctx.arcTo(x1, y0, x1, y0 + r, r);
  ctx.lineTo(x1, y1 - r);
  ctx.arcTo(x1, y1, x1 - r, y1, r);
  ctx.lineTo(x0 + r, y1);
  ctx.arcTo(x0, y1, x0, y1 - r, r);
  ctx.lineTo(x0, y0 + r);
  ctx.arcTo(x0, y0, x0 + r, y0, r);
  ctx.closePath();
}

function ornament(ctx, cx, cy) {
  ctx.fillStyle = GOLD;
  ctx.fillRect(cx - 135, cy - 1, 110, 2);
  ctx.fillRect(cx + 25, cy - 1, 110, 2);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9.9);
  ctx.lineTo(cx + 9.9, cy);
  ctx.lineTo(cx, cy + 9.9);
  ctx.lineTo(cx - 9.9, cy);
  ctx.closePath();
  ctx.fill();
}

/** Draws the card of one stanza; returns the canvas, or null when there is nothing to draw. */
export function drawCard(text, slug) {
  const lines = Card.lines(text);
  if (lines.length === 0) return null;
  const label = Card.genreLabel(slug);
  const w = Card.WIDTH;
  const hgt = Card.HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = hgt;
  const ctx = canvas.getContext('2d');
  ctx.direction = 'rtl';

  // Dark green ground, a little lighter in the middle.
  const ground = ctx.createRadialGradient(w * 0.5, hgt * 0.42, 0, w * 0.5, hgt * 0.42, 900);
  ground.addColorStop(0, GROUND_CENTER);
  ground.addColorStop(1, GROUND_EDGE);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, hgt);

  // The faint rabab behind the verse: turned 28 degrees, low left, 17 % visible.
  if (images.rubab) {
    ctx.save();
    ctx.globalAlpha = 43 / 255;
    ctx.translate(160, 1082);
    ctx.rotate((28 * Math.PI) / 180);
    ctx.drawImage(images.rubab, -170, -598, 340, 1196);
    ctx.restore();
  }

  // The double gold frame.
  ctx.lineWidth = 2;
  ctx.strokeStyle = GOLD_STRONG;
  roundRect(ctx, 37, 37, w - 37, hgt - 37, 5);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = GOLD_SOFT;
  roundRect(ctx, 52.5, 52.5, w - 52.5, hgt - 52.5, 2.5);
  ctx.stroke();

  // The verse: as large as fits.
  ctx.textAlign = 'center';
  ctx.font = `${Card.MAX_FONT}px ${FONT}`;
  let widest = 0;
  for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
  const size = Card.fontSize(widest, lines.length);
  const step = size * Card.LINE_FACTOR;
  const verseHeight = step * lines.length;

  // The block (genre name, ornament, verse, ornament) is centred above the footer; the name stands above the first ornament.
  const orn = 14;
  const labelBox = label ? LABEL_LINE + 20 : 0;
  const total = labelBox + orn + 46 + verseHeight + 56 + orn;
  let y = Math.max(70, (hgt - 170 - total) / 2);

  if (label) {
    ctx.font = `bold 52px ${FONT}`;
    ctx.fillStyle = GOLD;
    ctx.fillText(label, w / 2, baseline(ctx, y + LABEL_LINE / 2));
    y += labelBox;
  }
  ornament(ctx, w / 2, y + orn / 2);
  const verseTop = y + orn + 46;

  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = PAPER;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], w / 2, baseline(ctx, verseTop + (i + 0.5) * step));
  }
  ornament(ctx, w / 2, verseTop + verseHeight + 56 + orn / 2);

  // The app name at the bottom, with the small app icon on its right (the side where Pashto text starts).
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'left';
  const name = S.app_name;
  const nameWidth = ctx.measureText(name).width;
  const iconSize = 76;
  const gap = 22;
  const left = (w - (nameWidth + gap + iconSize)) / 2;
  const footerCentre = hgt - 104 - 32;
  ctx.fillText(name, left, baseline(ctx, footerCentre));
  if (images.icon) {
    const ix = left + nameWidth + gap;
    const iy = footerCentre - iconSize / 2;
    const r = iconSize * 0.22;
    ctx.save();
    roundRect(ctx, ix, iy, ix + iconSize, iy + iconSize, r);
    ctx.clip();
    ctx.drawImage(images.icon, ix, iy, iconSize, iconSize);
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = GOLD_STRONG;
    roundRect(ctx, ix, iy, ix + iconSize, iy + iconSize, r);
    ctx.stroke();
  }
  return canvas;
}

function dataUrlToFile(url, name) {
  const [head, data] = url.split(',');
  const type = /data:([^;]+)/.exec(head)[1];
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}

function showForSaving(url) {
  const view = h('div', { class: 'share-view', role: 'dialog', 'aria-modal': 'true' },
    h('img', { src: url, alt: '' }),
    h('p', null, rich(S.share_save_hint)),
    h('button', { class: 'btn btn-outlined', style: { color: '#F5DBA6', borderColor: '#D0A65D' }, onclick: () => view.remove() }, S.close),
  );
  document.body.append(view);
}

let lastShareAt = 0;

/** Draws the card of one stanza and opens the share sheet. Returns false when nothing could be shared. */
export function shareStanza(text, slug) {
  const now = Date.now();
  if (now - lastShareAt < 800) return true; // a double tap opens one sheet
  lastShareAt = now;
  let url;
  try {
    const canvas = drawCard(text, slug);
    if (!canvas) return false;
    url = canvas.toDataURL('image/png');
  } catch (e) {
    import('./widgets.js').then((w) => w.snackbar(S.share_failed));
    return false;
  }
  const file = dataUrlToFile(url, 'pashtani-wulsi-adab.png');
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch((e) => {
      if (e && e.name === 'AbortError') return; // the reader closed the sheet
      showForSaving(url);
    });
  } else {
    showForSaving(url);
  }
  return true;
}
