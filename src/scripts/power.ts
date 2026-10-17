// 電源：開機、睡眠、鎖定、關機、重新啟動、kernel panic
import { $, D, B, t, root, emit, beep, toast, getPrefs, savePrefs, fmt } from './core';
import { closeAll } from './wm';

const profileName = document.querySelector('.contact-name')?.textContent ?? B.user;

const body = document.body;
const power = $('#power');
let bootEl = $('#boot');
const bootTpl = bootEl.cloneNode(true) as HTMLElement;
let booting = false;
let tick = 0;

function show(cls: string, ...children: Node[]) {
  clearInterval(tick);
  power.className = `power ${cls}`;
  power.replaceChildren(...children);
  power.hidden = false;
}
function hide() {
  clearInterval(tick);
  power.hidden = true;
  power.replaceChildren();
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── 開機 ── */
function countBoot() {
  const boots = (getPrefs().boots ?? 0) + 1;
  savePrefs({ boots });
  const b = document.getElementById('sys-boots');
  if (b) b.textContent = String(boots);
}

function finishBoot() {
  if (!booting) return;
  booting = false;
  try { sessionStorage.setItem('booted', '1'); } catch {}
  bootEl.classList.add('done');
  setTimeout(() => { bootEl.hidden = true; emit('booted'); }, 350);
}

export function runBoot() {
  root.classList.remove('no-boot');
  const fresh = bootTpl.cloneNode(true) as HTMLElement;
  bootEl.replaceWith(fresh);
  bootEl = fresh;
  booting = true;
  countBoot();
  beep('boot');
  const timer = setTimeout(finishBoot, 3100);
  const skip = () => { clearTimeout(timer); finishBoot(); };
  fresh.addEventListener('click', skip);
  fresh.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') skip(); });
  fresh.focus({ preventScroll: true });
}

export function initBoot() {
  if (root.classList.contains('no-boot')) {
    bootEl.hidden = true;
    countBoot();
    setTimeout(() => emit('booted'), 50);
  } else runBoot();
}

/* ── 睡眠 ── */
export function sleep() {
  const clock = el('div', 'p-clock');
  const hint = el('div', 'p-hint', t.power.sleep);
  show('sleep', clock, hint);
  const move = () => {
    clock.textContent = new Date().toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
    clock.style.left = `${10 + Math.random() * 60}%`;
    clock.style.top = `${10 + Math.random() * 70}%`;
  };
  move();
  tick = window.setInterval(move, 4000);
  setTimeout(() => {
    const wake = () => {
      removeEventListener('keydown', wake);
      power.removeEventListener('pointerdown', wake);
      hide();
    };
    addEventListener('keydown', wake);
    power.addEventListener('pointerdown', wake);
  }, 600);
}

/* ── 鎖定 ── */
export function lock() {
  const time = el('div', 'p-time');
  const date = el('div', 'p-date');
  const avatar = el('div', 'p-avatar', B.logo);
  const user = el('div', 'p-user', profileName);
  const input = el('input');
  input.type = 'password';
  input.placeholder = t.power.lockPlaceholder;
  input.setAttribute('aria-label', t.power.lockPlaceholder);
  const msg = el('div', 'p-msg', t.power.lockHint);
  show('lock', time, date, avatar, user, input, msg);
  const upd = () => {
    const d = new Date();
    time.textContent = d.toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
    date.textContent = d.toLocaleDateString(t.dateLocale, { weekday: 'long', month: 'long', day: 'numeric' });
  };
  upd();
  tick = window.setInterval(upd, 1000);
  let wrong = 0;
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = input.value.trim().toLowerCase();
    if (D.persona.lockPassword.includes(v)) { hide(); toast(t.power.lockOk); return; }
    wrong++;
    beep('error');
    input.value = '';
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    if (wrong >= 3) { msg.textContent = t.power.lockGiveUp; setTimeout(hide, 1100); }
    else msg.textContent = t.power.lockWrong;
  });
  setTimeout(() => input.focus(), 50);
}

/* ── 關機／重新啟動 ── */
async function goDark(label: string) {
  show('going', el('div', 'p-msg', label));
  closeAll();
  await wait(900);
  body.classList.add('screen-off');
  await wait(600);
}

export async function shutdown() {
  await goDark(t.power.shuttingDown);
  const btn = el('button', 'p-btn', '⏻');
  btn.setAttribute('aria-label', t.power.powerOn);
  show('off', btn, el('div', 'p-hint', t.power.powerOn));
  btn.focus();
  btn.addEventListener('click', () => {
    body.classList.remove('screen-off');
    hide();
    runBoot();
  });
}

export async function restart() {
  await goDark(t.power.restarting);
  await wait(500);
  body.classList.remove('screen-off');
  hide();
  runBoot();
}

/* ── Kernel panic（rm -rf /） ── */
export async function panic() {
  body.classList.add('glitching');
  beep('error');
  await wait(900);
  body.classList.remove('glitching');
  closeAll();
  const pre = el('pre', '', t.power.panic.join('\n'));
  const count = el('div', 'p-count');
  show('panic', el('div', '', ''), pre);
  pre.after(count);
  let n = 5;
  count.textContent = fmt(t.power.rebootIn, { s: n });
  await new Promise<void>((done) => {
    tick = window.setInterval(() => {
      n--;
      count.textContent = fmt(t.power.rebootIn, { s: n });
      if (n <= 0) { clearInterval(tick); done(); }
    }, 1000);
  });
  hide();
  runBoot();
}
