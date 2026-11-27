// The silent rubab of the home page, hanging by a short cord from a nail (ui/rubab/HangingRubab.kt of the Android
// app). It swings like a real pendulum:
//     θ'' = ( -sideways · cos θ  -  g · sin θ ) / L  -  damping · θ'
// On a phone browser that gives motion data without asking (Android), it follows the phone like the Android app. An
// iPhone would show a permission question on EVERY start, so there the rubab is not tied to the motion sensor; a tap
// on the rubab gives it a push instead.

import { h } from './dom.js';
import { S } from '../strings.js';

const GRAVITY = 9.81;
const LENGTH = 0.45;
const DAMPING = 1.4;
const DEAD_ZONE = 0.4;
const MAX_PUSH = 30;
const MAX_ANGLE = 0.6;
const SMOOTHING = 0.35;
const SUBSTEP = 0.008;
const TAP_SPEED = 2.4; // radians per second added by one tap

export const CORD = 34;

function drawNail(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = 14 * dpr;
  canvas.height = 14 * dpr;
  const ctx = canvas.getContext('2d');
  const r = 7 * dpr;
  const c = 7 * dpr;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath(); ctx.arc(c + r * 0.22, c + r * 0.32, r * 0.92, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(c - r * 0.35, c - r * 0.35, 0, c - r * 0.35, c - r * 0.35, r * 1.5);
  g.addColorStop(0, '#F3E2B8');
  g.addColorStop(0.55, '#B8935A');
  g.addColorStop(1, '#6E5430');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c, c, r * 0.93, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4A381E';
  ctx.lineWidth = r * 0.14;
  ctx.beginPath(); ctx.arc(c, c, r * 0.86, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath(); ctx.arc(c - r * 0.38, c - r * 0.4, r * 0.16, 0, Math.PI * 2); ctx.fill();
}

/** Builds the nail, the cord and the rubab. Call start() while the home page is visible and stop() when it is not. */
export function hangingRubab(height) {
  const img = h('img', { class: 'rubab-img', src: 'assets/img/rubab.webp', alt: S.rubab_desc, draggable: 'false', style: { height: `${height}px` } });
  const swing = h('div', { class: 'rubab-swing' }, h('div', { class: 'rubab-cord' }), img);
  const nail = h('canvas', { class: 'rubab-nail', 'aria-hidden': 'true' });
  const layer = h('div', { class: 'rubab-layer' }, swing, nail);
  drawNail(nail);

  let angle = 0;
  let velocity = 0;
  let filtered = 0;
  let sideways = 0;
  let raf = 0;
  let last = 0;
  let running = false;

  const paint = () => {
    swing.style.transform = `translateX(-50%) rotate(${(-angle * 180) / Math.PI}deg)`;
  };
  paint();

  const quiet = (v) => (v > DEAD_ZONE ? v - DEAD_ZONE : v < -DEAD_ZONE ? v + DEAD_ZONE : 0);

  const step = (dt) => {
    filtered += (sideways - filtered) * SMOOTHING;
    const push = Math.max(-MAX_PUSH, Math.min(MAX_PUSH, quiet(filtered)));
    let left = dt;
    while (left > 0) {
      const hh = Math.min(left, SUBSTEP);
      left -= hh;
      const a = angle;
      const acc = (-push * Math.cos(a) - GRAVITY * Math.sin(a)) / LENGTH - DAMPING * velocity;
      velocity += acc * hh;
      let next = a + velocity * hh;
      if (next > MAX_ANGLE || next < -MAX_ANGLE) {
        next = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, next));
        velocity = -velocity * 0.3; // it bumps softly against the limit
      }
      angle = next;
    }
  };

  const frame = (now) => {
    const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0;
    last = now;
    step(dt);
    paint();
    // Asleep (still and straight, no push): stop drawing until something moves it.
    if (Math.abs(angle) < 0.0005 && Math.abs(velocity) < 0.0005 && quiet(filtered) === 0 && !motionOn) {
      angle = 0; velocity = 0; paint(); raf = 0; last = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (running && !raf) { last = 0; raf = requestAnimationFrame(frame); } };

  // Motion data only where it comes without a permission question (not on iPhone, see above).
  let motionOn = false;
  const onMotion = (e) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    const turn = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    const x = g.x;
    const y = g.y || 0;
    sideways = turn === 90 ? -y : turn === 180 ? -x : (turn === 270 || turn === -90) ? y : x;
    wake();
  };
  const canMotion = typeof window.DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission !== 'function';

  img.addEventListener('click', (e) => {
    const box = img.getBoundingClientRect();
    const dir = e.clientX > box.left + box.width / 2 ? -1 : 1;
    velocity += dir * TAP_SPEED;
    wake();
  });

  return {
    el: layer,
    start() {
      if (running) return;
      running = true;
      if (canMotion) { window.addEventListener('devicemotion', onMotion); motionOn = true; }
      wake();
    },
    stop() {
      running = false;
      if (motionOn) { window.removeEventListener('devicemotion', onMotion); motionOn = false; }
      cancelAnimationFrame(raf);
      raf = 0;
      angle = 0; velocity = 0; filtered = 0; sideways = 0; last = 0;
      paint();
    },
  };
}
