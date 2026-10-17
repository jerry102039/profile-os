// 行事曆：月曆、上下月、今天、選日期看行程、新增／刪除行程（存在訪客瀏覽器）
import { $, D, t, getPrefs, savePrefs, beep } from '../core';

const root = $('#cal');
const today = new Date();
let view = new Date(today.getFullYear(), today.getMonth(), 1);
let sel = new Date(today.getFullYear(), today.getMonth(), today.getDate());

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const same = (a: Date, b: Date) => key(a) === key(b);

// 內建行程：profile.yaml 的 persona.calendar（MM-DD，每年都提醒）
const builtin = (d: Date) => D.persona.calendar.filter((e) => e.date === key(d).slice(5)).map((e) => e.title);
const userEvents = () => getPrefs().events ?? {};
const eventsOf = (d: Date) => [...builtin(d), ...(userEvents()[key(d)] ?? [])];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render() {
  root.replaceChildren();
  const main = el('div', 'cal-main');
  const top = el('div', 'cal-top');
  const h = el('h3', '', view.toLocaleDateString(t.dateLocale, { year: 'numeric', month: 'long' }));
  const prev = el('button', '', '‹'); prev.title = t.cal.prev; prev.setAttribute('aria-label', t.cal.prev);
  const tod = el('button', '', t.cal.today);
  const next = el('button', '', '›'); next.title = t.cal.next; next.setAttribute('aria-label', t.cal.next);
  prev.onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); };
  next.onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };
  tod.onclick = () => { view = new Date(today.getFullYear(), today.getMonth(), 1); sel = new Date(today); render(); };
  top.append(h, prev, tod, next);

  const grid = el('div', 'cal-grid');
  t.cal.weekdays.forEach((w) => grid.append(el('div', 'cal-wd', w)));
  const start = new Date(view);
  start.setDate(1 - view.getDay());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const cell = el('button', 'cal-day');
    if (d.getMonth() !== view.getMonth()) cell.classList.add('other');
    if (d.getDay() === 0 || d.getDay() === 6) cell.classList.add('weekend');
    if (same(d, today)) cell.classList.add('today');
    if (same(d, sel)) cell.classList.add('sel');
    cell.append(el('span', 'n', String(d.getDate())));
    eventsOf(d).slice(0, 2).forEach((ev) => cell.append(el('span', 'ev', ev)));
    cell.onclick = () => { sel = d; if (d.getMonth() !== view.getMonth()) view = new Date(d.getFullYear(), d.getMonth(), 1); render(); };
    grid.append(cell);
  }
  main.append(top, grid);

  // 側欄：選取日期的行程
  const side = el('div', 'cal-side');
  side.append(el('h4', '', sel.toLocaleDateString(t.dateLocale, { month: 'long', day: 'numeric', weekday: 'long' })));
  const list = el('ul', 'cal-events');
  const evs = eventsOf(sel);
  const builtinCount = builtin(sel).length;
  if (!evs.length) list.append(el('li', 'dim', t.cal.noEvents));
  evs.forEach((ev, i) => {
    const li = el('li');
    li.append(el('span', '', ev));
    if (i >= builtinCount) {
      const del = el('button', '', '×');
      del.title = t.cal.del;
      del.setAttribute('aria-label', t.cal.del);
      del.onclick = () => {
        const all = { ...userEvents() };
        all[key(sel)] = (all[key(sel)] ?? []).filter((_, j) => j !== i - builtinCount);
        if (!all[key(sel)].length) delete all[key(sel)];
        savePrefs({ events: all });
        beep('close');
        render();
      };
      li.append(del);
    }
    list.append(li);
  });
  const input = el('input');
  input.placeholder = t.cal.placeholder;
  input.setAttribute('aria-label', t.cal.add);
  input.maxLength = 60;
  input.onkeydown = (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    const all = { ...userEvents() };
    all[key(sel)] = [...(all[key(sel)] ?? []), input.value.trim()];
    savePrefs({ events: all });
    beep('open');
    render();
    root.querySelector<HTMLInputElement>('.cal-side input')?.focus();
  };
  side.append(list, input, el('small', '', t.cal.localNote));
  root.append(main, side);
}

export function initCalendar() {
  render();
}
