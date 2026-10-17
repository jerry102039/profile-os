// 音樂播放器：播 site.ts 列的音檔；沒有音檔時用 WebAudio 即時合成三首內建曲目。
// 視窗關掉音樂會繼續播（模組載入後就一直在），選單列會顯示正在播放。
import { $, $$, B, t, getPrefs, savePrefs, emit } from '../core';
import { isOpen, setTitle } from '../wm';
import { accentRgb, accent2Rgb, isLight } from '../theme';

type Track = { id: string; title: string; artist: string; synth: SynthId; dur: number; glyph: string };
type SynthId = 'chip' | 'lofi' | 'drone';
const M = () => t.music;

const tracks: Track[] = [
  { id: 'chip', title: M().tracks.chip, artist: M().builtin, synth: 'chip', dur: 128, glyph: '▣' },
  { id: 'lofi', title: M().tracks.lofi, artist: M().builtin, synth: 'lofi', dur: 160, glyph: '☕' },
  { id: 'drone', title: M().tracks.drone, artist: M().builtin, synth: 'drone', dur: 180, glyph: '◉' },
];

/* ── 狀態 ── */
let idx = Math.max(0, tracks.findIndex((x) => x.id === getPrefs().musicTrack));
let playing = false;
let shuffle = !!getPrefs().musicShuffle;
let repeat: 'off' | 'all' | 'one' = getPrefs().musicRepeat ?? 'all';
let volume = getPrefs().musicVol ?? 60;
const cur = () => tracks[idx];

/* ── 音訊圖：來源 → master → analyser → 喇叭 ── */
let actx: AudioContext | null = null;
let master: GainNode, analyser: AnalyserNode;
function audio() {
  if (!actx) {
    actx = new AudioContext();
    master = actx.createGain();
    analyser = actx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;
    master.connect(analyser).connect(actx.destination);
    master.gain.value = volume / 100;
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

/* 合成器：固定節拍的 step sequencer，用 lookahead 排程 */
const NOTE = (n: number) => 440 * 2 ** ((n - 69) / 12);
let seqTimer = 0, step = 0, nextTime = 0, synthStart = 0, synthOffset = 0;
let noiseBuf: AudioBuffer | null = null;
function noise() {
  const c = audio();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function tone(type: OscillatorType, freq: number, at: number, dur: number, gain: number, o: { a?: number; r?: number; lp?: number; detune?: number; slide?: number } = {}) {
  const c = audio();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), at + dur);
  if (o.detune) osc.detune.value = o.detune;
  const a = o.a ?? 0.01, r = o.r ?? 0.05;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + a);
  g.gain.setValueAtTime(gain, at + Math.max(a, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur + r);
  let node: AudioNode = osc;
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
  node.connect(g).connect(master);
  osc.start(at);
  osc.stop(at + dur + r + 0.05);
}
function hit(at: number, dur: number, gain: number, type: BiquadFilterType, freq: number) {
  const c = audio();
  const s = c.createBufferSource();
  s.buffer = noise();
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(master);
  s.start(at);
  s.stop(at + dur + 0.02);
}

// 每首曲子：bpm + 每個 16 分音符要做的事（s = 第幾步，at = 時間）
const SYNTH: Record<SynthId, { bpm: number; bars: number; play: (s: number, at: number, spb: number) => void }> = {
  chip: {
    bpm: 150, bars: 8,
    play: (s, at, spb) => {
      const chords = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; // Am F C G
      const bar = Math.floor(s / 16) % 4, ch = chords[bar];
      const arp = [0, 1, 2, 1, 0, 2, 1, 2][s % 8];
      tone('square', NOTE(ch[arp] + 12), at, spb * 0.5, 0.05, { r: 0.03 });
      if (s % 4 === 0) tone('triangle', NOTE(ch[0] - 12), at, spb * 1.6, 0.16, { r: 0.05 });
      if (s % 8 === 0) tone('sine', 150, at, 0.12, 0.5, { slide: 0.3, r: 0.02 });
      if (s % 8 === 4) hit(at, 0.12, 0.25, 'bandpass', 1800);
      if (s % 2 === 1) hit(at, 0.03, 0.08, 'highpass', 7000);
      if (s % 32 >= 24 && s % 2 === 0) tone('square', NOTE(ch[2] + 24), at, spb * 0.4, 0.03, { r: 0.02 });
    },
  },
  lofi: {
    bpm: 78, bars: 8,
    play: (s, at, spb) => {
      const chords = [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]]; // Fmaj7 Em7 Dm7 Cmaj7
      const bar = Math.floor(s / 16) % 4, ch = chords[bar];
      const sw = s % 2 ? spb * 0.18 : 0; // 一點 swing
      if (s % 16 === 0) ch.forEach((n, i) => tone('triangle', NOTE(n), at + i * 0.02, spb * 14, 0.07, { a: 0.4, r: 1.2, lp: 1400, detune: (i - 1.5) * 4 }));
      if (s % 8 === 0) tone('sine', NOTE(ch[0] - 24), at, spb * 3, 0.22, { a: 0.02, r: 0.3 });
      if (s % 16 === 0 || s % 16 === 10) tone('sine', 110, at, 0.25, 0.6, { slide: 0.35, r: 0.05 });
      if (s % 16 === 4 || s % 16 === 12) hit(at + sw, 0.18, 0.18, 'bandpass', 2200);
      if (s % 2 === 0) hit(at + sw, 0.04, 0.05, 'highpass', 8000);
      if (s % 32 === 22) tone('sine', NOTE(ch[3] + 12), at, spb * 2, 0.05, { a: 0.05, r: 0.6 });
      hit(at, spb, 0.012, 'lowpass', 900); // 黑膠雜訊
    },
  },
  drone: {
    bpm: 60, bars: 8,
    play: (s, at, spb) => {
      if (s % 64 === 0) [45, 52, 57, 59].forEach((n, i) => tone('sawtooth', NOTE(n), at + i * 0.3, spb * 66, 0.035, { a: 3, r: 4, lp: 500 + i * 120, detune: (i % 2 ? 1 : -1) * 6 }));
      if (s % 16 === 0) tone('sine', NOTE(33), at, spb * 17, 0.18, { a: 1.5, r: 2 });
      if (s % 32 === 0) hit(at, spb * 32, 0.02, 'lowpass', 300); // 風扇
      if (s % 6 === 0 && Math.random() < 0.3) tone('sine', NOTE([69, 71, 74, 76, 81][Math.floor(Math.random() * 5)]), at, spb * 3, 0.05, { a: 0.01, r: 2.5 });
    },
  },
};
function synthTick() {
  const c = audio();
  const def = SYNTH[cur().synth];
  const spb = 60 / def.bpm / 4;
  while (nextTime < c.currentTime + 0.15) {
    def.play(step, nextTime, spb);
    step = (step + 1) % (def.bars * 16);
    nextTime += spb;
    if ((synthOffset + (c.currentTime - synthStart)) >= cur().dur) { onEnded(); return; }
  }
}
function synthPlay(from = 0) {
  const c = audio();
  const def = SYNTH[cur().synth];
  const spb = 60 / def.bpm / 4;
  synthOffset = from;
  synthStart = c.currentTime;
  step = Math.floor(from / spb) % (def.bars * 16);
  nextTime = c.currentTime + 0.05;
  clearInterval(seqTimer);
  seqTimer = window.setInterval(synthTick, 40);
}
function synthStop() { clearInterval(seqTimer); seqTimer = 0; }

/* ── 控制 ── */
const position = () => (seqTimer ? synthOffset + (audio().currentTime - synthStart) : synthOffset);

export function play(which?: string) {
  if (which !== undefined) {
    const i = tracks.findIndex((x) => x.id === which || x.title.toLowerCase() === which.toLowerCase());
    if (i >= 0) { stopCurrent(); idx = i; synthOffset = 0; }
  }
  audio();
  const tr = cur();
  synthPlay(synthOffset);
  playing = true;
  savePrefs({ musicTrack: tr.id });
  setSession();
  (window as any).__music = true;
  emit('music', true);
  paint();
}
export function pause() {
  synthOffset = position();
  synthStop();
  playing = false;
  (window as any).__music = false;
  emit('music', false);
  paint();
}
function stopCurrent() {
  synthStop();
  synthOffset = 0;
}
export const toggle = () => (playing ? pause() : play());
function pick(dir: 1 | -1) {
  if (shuffle && tracks.length > 1) { let n = idx; while (n === idx) n = Math.floor(Math.random() * tracks.length); return n; }
  return (idx + dir + tracks.length) % tracks.length;
}
export function next() { stopCurrent(); idx = pick(1); play(); }
export function prev() { if (position() > 3) { seek(0); return; } stopCurrent(); idx = pick(-1); play(); }
function onEnded() {
  if (repeat === 'one') { seek(0); return; }
  if (repeat === 'off' && !shuffle && idx === tracks.length - 1) { stopCurrent(); playing = false; paint(); return; }
  next();
}
function seek(sec: number) {
  synthStop();
  synthOffset = sec;
  if (playing) synthPlay(sec);
  paint();
}
function setVolume(v: number) {
  volume = Math.max(0, Math.min(100, v));
  if (actx) master.gain.value = volume / 100;
  savePrefs({ musicVol: volume });
}
function setSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: cur().title, artist: cur().artist, album: B.os });
  navigator.mediaSession.setActionHandler('play', () => play());
  navigator.mediaSession.setActionHandler('pause', () => pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => next());
  navigator.mediaSession.setActionHandler('previoustrack', () => prev());
}

/* ── 畫面 ── */
const fmt = (s: number) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '–:––');
let ui: Record<string, HTMLElement> = {};
let raf = 0;

function paint() {
  const tr = cur();
  const tray = $('#tray-music');
  tray.hidden = !playing;
  tray.querySelector('span')!.textContent = tr.title;
  if (!ui.title) return;
  ui.title.textContent = tr.title;
  ui.artist.textContent = tr.artist;
  ui.glyph.textContent = tr.glyph;
  ui.play.textContent = playing ? '❚❚' : '▶';
  ui.play.setAttribute('aria-label', playing ? M().pause : M().play);
  ui.shuffle.classList.toggle('on', shuffle);
  ui.repeat.classList.toggle('on', repeat !== 'off');
  ui.repeat.textContent = repeat === 'one' ? '↻¹' : '↻';
  ui.note.textContent = M().synthNote;
  $$('#mu-list li').forEach((li, i) => li.classList.toggle('on', i === idx));
  setTitle('music', `${t.appNames.music}${playing ? ` — ${tr.title}` : ''}`);
  $('#mu-root').classList.toggle('playing', playing);
  tick();
}
function tick() {
  if (!ui.seek) return;
  const pos = position(), dur = cur().dur;
  (ui.seek as HTMLInputElement).value = String(dur ? (pos / dur) * 1000 : 0);
  ui.time.textContent = `${fmt(pos)} / ${fmt(dur)}`;
}
function drawViz() {
  raf = 0;
  if (!isOpen('music') || document.hidden) return;
  const cv = ui.viz as HTMLCanvasElement;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== w) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  if (actx && playing) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const n = 40, bw = w / n;
    const [r, g, b] = accentRgb(), [r2, g2, b2] = accent2Rgb();
    for (let i = 0; i < n; i++) {
      const v = data[Math.floor((i / n) * data.length * 0.7)] / 255;
      const bh = Math.max(2, v * h);
      const k = i / n;
      ctx.fillStyle = `rgba(${Math.round(r + (r2 - r) * k)},${Math.round(g + (g2 - g) * k)},${Math.round(b + (b2 - b) * k)},${isLight() ? 0.75 : 0.85})`;
      ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
    }
  }
  tick();
  raf = requestAnimationFrame(drawViz);
}

export function initMusic() {
  const root = $('#mu-root');
  ui = {
    title: $('#mu-title'), artist: $('#mu-artist'), glyph: $('#mu-glyph'), play: $('#mu-play'), shuffle: $('#mu-shuffle'),
    repeat: $('#mu-repeat'), seek: $('#mu-seek'), time: $('#mu-time'), viz: $('#mu-viz'), note: $('#mu-note'),
  };
  const list = $('#mu-list');
  list.replaceChildren(...tracks.map((tr, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    const g = document.createElement('i'); g.textContent = tr.glyph;
    const tt = document.createElement('span'); tt.textContent = tr.title;
    const ar = document.createElement('small'); ar.textContent = tr.artist;
    li.append(g, tt, ar);
    li.addEventListener('click', () => { stopCurrent(); idx = i; play(); });
    return li;
  }));
  ui.play.addEventListener('click', () => toggle());
  $('#mu-prev').addEventListener('click', prev);
  $('#mu-next').addEventListener('click', next);
  ui.shuffle.addEventListener('click', () => { shuffle = !shuffle; savePrefs({ musicShuffle: shuffle }); paint(); });
  ui.repeat.addEventListener('click', () => { repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'; savePrefs({ musicRepeat: repeat }); paint(); });
  const seekEl = ui.seek as HTMLInputElement;
  seekEl.addEventListener('input', () => seek((Number(seekEl.value) / 1000) * cur().dur));
  const vol = $<HTMLInputElement>('#mu-vol');
  vol.value = String(volume);
  vol.addEventListener('input', () => setVolume(Number(vol.value)));
  root.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === ' ') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' && e.shiftKey) next();
    else if (e.key === 'ArrowLeft' && e.shiftKey) prev();
  });
  paint();
  drawViz();
}

/** 給 main.ts 的動作入口：music:play[:曲名] / pause / next / prev / toggle */
export function command(arg?: string) {
  const [c, ...rest] = (arg ?? 'toggle').split(':');
  if (c === 'play') play(rest.length ? rest.join(':') : undefined);
  else if (c === 'pause') pause();
  else if (c === 'next') next();
  else if (c === 'prev') prev();
  else toggle();
}
export const resumeViz = () => { if (!raf && ui.viz) drawViz(); };
