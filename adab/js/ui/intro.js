// The opening scene, the same as ui/intro/IntroScreen.kt of the Android app: the rubab fades in while the real rubab
// recording plays once, the name of the app appears, and the scene fades out (6.5 s). "تېر کړه" skips it.
//
// A web page may only start a sound after a tap. Where the browser does not allow the sound yet (iPhone), the scene
// waits behind a "پیل کړه" button, and the tap starts picture and sound together.

import { h } from './dom.js';
import { S } from '../strings.js';

const DURATION = 5.6; // seconds of the scene
const FADE = 0.9; // the fade-out at the end
const SKIP_FADE = 0.25; // the quick fade-out after "تېر کړه"
const DUST = 18;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

async function prepareSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx = new Ctx();
    const data = await (await fetch('assets/audio/intro.m4a')).arrayBuffer();
    const buffer = await new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(data, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
    return { ctx, buffer };
  } catch (e) {
    return null;
  }
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((r) => setTimeout(() => r(null), ms))]);
}

/** Plays the opening scene; resolves once it has faded out (normally or after a skip). */
export function playIntro() {
  return new Promise((resolve) => {
    const canvas = h('canvas');
    const rubab = h('img', { class: 'intro-rubab', src: 'assets/img/rubab.webp', alt: '' });
    const dim = h('div', { class: 'intro-dim' });
    const scene = h('div', { class: 'intro-scene' }, rubab, dim);
    const title = h('div', { class: 'intro-title' },
      h('h1', null, S.app_name),
      h('div', { class: 'rule' }),
      h('div', { class: 'sub' }, S.intro_subtitle),
    );
    const skip = h('button', { class: 'intro-skip', style: { pointerEvents: 'none' } }, S.intro_skip);
    const root = h('div', { class: 'intro', role: 'presentation' }, canvas, scene, title, skip);
    document.body.append(root);

    const rand = seeded(17);
    const dust = Array.from({ length: DUST }, () => [5 + rand() * 90, 8 + rand() * 84, rand() * 5, 4 + rand() * 3]);
    const ctx2d = canvas.getContext('2d');

    let elapsed = 0; // seconds of the scene (stands still while the app is in the background)
    let wall = 0; // seconds for the background, also before the scene starts
    let started = false;
    let skipped = false;
    let ending = false;
    let soft = false;
    let last = 0;
    let sound = null;
    let source = null;
    let gain = null;
    let raf = 0;

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(root.clientWidth * dpr);
      canvas.height = Math.round(root.clientHeight * dpr);
    };
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);

    const drawBackground = () => {
      const w = canvas.width;
      const hh = canvas.height;
      const dpr = w / Math.max(1, root.clientWidth);
      const reach = Math.hypot(w * 0.5, hh * 0.56);
      let g = ctx2d.createRadialGradient(w * 0.5, hh * 0.44, 0, w * 0.5, hh * 0.44, reach);
      g.addColorStop(0, '#422918');
      g.addColorStop(0.45, '#211309');
      g.addColorStop(0.85, '#0B0603');
      g.addColorStop(1, '#0B0603');
      ctx2d.fillStyle = g;
      ctx2d.fillRect(0, 0, w, hh);
      const t = started ? elapsed : wall;
      const breathing = 0.4 + 0.6 * ((Math.sin((t * Math.PI) / 4 - Math.PI / 2) + 1) / 2);
      g = ctx2d.createRadialGradient(w * 0.5, hh * 0.46, 0, w * 0.5, hh * 0.46, reach * 0.75);
      g.addColorStop(0, `rgba(226, 184, 106, ${0.18 * breathing})`);
      g.addColorStop(1, 'rgba(226, 184, 106, 0)');
      ctx2d.fillStyle = g;
      ctx2d.fillRect(0, 0, w, hh);
      for (const d of dust) {
        const p = ((t + d[2]) / d[3]) % 1;
        const a = p < 0.35 ? (0.5 * p) / 0.35 : (0.5 * (1 - p)) / 0.65;
        const x = (w * d[0]) / 100;
        const y = (hh * d[1]) / 100 + (15 - 80 * p) * dpr;
        ctx2d.fillStyle = `rgba(240, 207, 136, ${a * 0.25})`;
        ctx2d.beginPath(); ctx2d.arc(x, y, 4 * dpr, 0, Math.PI * 2); ctx2d.fill();
        ctx2d.fillStyle = `rgba(240, 207, 136, ${a})`;
        ctx2d.beginPath(); ctx2d.arc(x, y, 1.2 * dpr, 0, Math.PI * 2); ctx2d.fill();
      }
    };

    const drawScene = () => {
      const w = root.clientWidth;
      const land = w > root.clientHeight;
      const shift = land ? w * -0.1 : 0;
      const rp = smooth((elapsed - 0.15) / 1.2);
      const s = 0.92 - 0.08 * (1 - rp);
      const rh = rubab.offsetHeight;
      rubab.style.opacity = String(rp);
      rubab.style.transform = `translate(calc(-50% + ${shift}px), calc(-50% + ${rh * 0.04 * (1 - rp)}px)) scale(${s})`;
      if (!soft && elapsed / DURATION > 0.38) { soft = true; scene.classList.add('soft'); }
      const tp = smooth((elapsed - 0.25 * DURATION) / 1.15);
      title.style.opacity = String(tp);
      title.style.transform = `translateX(${land ? w * -0.08 : 0}px) scale(${0.94 + 0.06 * tp})`;
      skip.style.opacity = String(smooth((elapsed - 0.2) / 0.6));
    };

    const finish = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', sizeCanvas);
      document.removeEventListener('visibilitychange', onVisibility);
      root.remove();
      if (sound) setTimeout(() => { try { sound.ctx.close(); } catch (e) { /* closed */ } }, 7000);
      resolve();
    };

    const end = (fast) => {
      if (ending) return;
      ending = true;
      if (fast) {
        root.classList.add('fast');
        if (gain && sound) {
          const now = sound.ctx.currentTime;
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + SKIP_FADE);
        }
      }
      root.classList.add('out');
      setTimeout(finish, (fast ? SKIP_FADE : FADE) * 1000 + 30);
    };

    const frame = (now) => {
      const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0;
      last = now;
      wall += dt;
      if (started && !ending) {
        elapsed += dt;
        if (elapsed >= DURATION) end(false);
      }
      drawBackground();
      if (started) drawScene();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      if (!sound) return;
      try {
        if (document.hidden) sound.ctx.suspend();
        else if (started) sound.ctx.resume();
      } catch (e) { /* nothing */ }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const begin = () => {
      if (started) return;
      started = true;
      skip.style.pointerEvents = '';
      if (sound) {
        try {
          if (sound.ctx.state !== 'running') sound.ctx.resume();
          gain = sound.ctx.createGain();
          gain.connect(sound.ctx.destination);
          source = sound.ctx.createBufferSource();
          source.buffer = sound.buffer;
          source.connect(gain);
          source.start();
        } catch (e) { /* the scene still plays, silently */ }
      }
    };

    skip.addEventListener('click', () => { if (!skipped) { skipped = true; if (!started) begin(); end(true); } });

    withTimeout(prepareSound(), 2500).then(async (prepared) => {
      sound = prepared;
      if (!sound) { begin(); return; }
      try { await withTimeout(sound.ctx.resume(), 300); } catch (e) { /* not allowed yet */ }
      if (sound.ctx.state === 'running') { begin(); return; }
      // The browser wants a tap before any sound: the scene waits for it.
      const startBtn = h('button', { class: 'intro-start' }, S.intro_start);
      startBtn.addEventListener('click', () => {
        startBtn.remove();
        try { sound.ctx.resume(); } catch (e) { /* nothing */ }
        begin();
      }, { once: true });
      root.append(startBtn);
    });
  });
}
