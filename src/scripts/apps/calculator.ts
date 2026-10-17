// 計算機：macOS 計算機的行為（連續運算、重複按 =、%、±、AC/C、鍵盤輸入）
import { $, $$, t, beep } from '../core';
import { isOpen, topWindow } from '../wm';

const out = $('#calc-out');
const expr = $('#calc-expr');
const clearBtn = $('#calc-clear');
const root = $('#calc');

type Op = '+' | '-' | '*' | '/';
let display = '0';      // 目前顯示的數字（字串，保留使用者輸入）
let acc: number | null = null; // 累積值
let op: Op | null = null;
let fresh = true;       // 下一個數字鍵是否開始新數字
let lastOp: Op | null = null;  // 重複按 = 用
let lastArg = 0;
let error = false;

const SYM: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function fmt(n: number): string {
  if (!isFinite(n)) return t.calc.error;
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) return n.toExponential(6).replace(/\.?0+e/, 'e');
  const s = String(Number(n.toPrecision(12)));
  const [i, d] = s.split('.');
  return Number(i).toLocaleString('en-US') + (d ? '.' + d : '');
}

function apply(a: number, b: number, o: Op): number {
  switch (o) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? NaN : a / b;
  }
}

function render() {
  const raw = display.includes('e') || error ? display : (() => {
    const neg = display.startsWith('-');
    const [i, d] = display.replace('-', '').split('.');
    return (neg ? '-' : '') + Number(i).toLocaleString('en-US') + (display.includes('.') ? '.' + (d ?? '') : '');
  })();
  out.textContent = error ? t.calc.error : raw;
  // 字太長就縮小
  out.style.fontSize = raw.length > 11 ? `${Math.max(20, 44 - (raw.length - 11) * 3)}px` : '';
  clearBtn.textContent = display !== '0' && !fresh ? 'C' : 'AC';
  $$('.op', root).forEach((b) => b.classList.toggle('armed', fresh && op !== null && b.dataset.k === op));
  expr.textContent = acc !== null && op ? `${fmt(acc)} ${SYM[op]}` : '';
}

function press(k: string) {
  if (error && k !== 'clear') reset();
  if (/^\d$/.test(k)) {
    if (fresh) { display = k; fresh = false; }
    else if (display.replace(/[-.]/g, '').length < 12) display = display === '0' ? k : display + k;
  } else if (k === '.') {
    if (fresh) { display = '0.'; fresh = false; }
    else if (!display.includes('.')) display += '.';
  } else if (k === 'clear') {
    if (clearBtn.textContent === 'C') { display = '0'; fresh = true; } else reset();
  } else if (k === 'neg') {
    display = display.startsWith('-') ? display.slice(1) : display === '0' ? '0' : '-' + display;
  } else if (k === 'pct') {
    const v = Number(display);
    // 跟 macOS 一樣：在 + − 時是「累積值的百分比」，否則是除以 100
    const r = acc !== null && (op === '+' || op === '-') ? (acc * v) / 100 : v / 100;
    display = String(Number(r.toPrecision(12)));
    fresh = false;
  } else if (k === '+' || k === '-' || k === '*' || k === '/') {
    const v = Number(display);
    if (acc !== null && op && !fresh) {
      const r = apply(acc, v, op);
      if (!isFinite(r)) return fail();
      acc = r;
      display = String(Number(r.toPrecision(12)));
    } else if (acc === null || !op) acc = v;
    op = k;
    fresh = true;
  } else if (k === '=') {
    const v = Number(display);
    if (op && acc !== null) {
      const b = fresh ? acc : v;
      const r = apply(acc, b, op);
      if (!isFinite(r)) return fail();
      lastOp = op; lastArg = b;
      display = String(Number(r.toPrecision(12)));
      acc = null; op = null;
    } else if (lastOp) {
      const r = apply(v, lastArg, lastOp);
      if (!isFinite(r)) return fail();
      display = String(Number(r.toPrecision(12)));
    }
    fresh = true;
  }
  render();
}

function fail() {
  error = true;
  display = '0'; acc = null; op = null; fresh = true;
  beep('error');
  out.textContent = t.calc.error;
  expr.textContent = t.calc.divZero;
}

function reset() {
  display = '0'; acc = null; op = null; fresh = true; lastOp = null; error = false;
}

function flash(k: string) {
  const b = root.querySelector<HTMLElement>(`[data-k="${CSS.escape(k)}"]`);
  if (!b) return;
  b.classList.add('press');
  setTimeout(() => b.classList.remove('press'), 100);
}

export function initCalculator() {
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k]');
    if (b) press(b.dataset.k!);
  });
  addEventListener('keydown', (e) => {
    if (!isOpen('calculator') || topWindow()?.id !== 'calculator' || e.metaKey || e.ctrlKey || e.altKey) return;
    const map: Record<string, string> = { Enter: '=', '=': '=', Escape: 'clear', Delete: 'clear', '%': 'pct', ',': '.', x: '*', X: '*' };
    let k = map[e.key] ?? e.key;
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (!fresh) { display = display.length > 1 && display !== '-0' ? display.slice(0, -1) : '0'; if (display === '-') display = '0'; render(); }
      return;
    }
    if (/^[\d.+\-*/=]$/.test(k) || k === 'clear' || k === 'pct') {
      e.preventDefault();
      press(k);
      flash(k);
    }
  });
  render();
}
