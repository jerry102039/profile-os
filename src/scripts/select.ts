// 桌面圖示：跟真的桌面一樣單擊選取、雙擊開啟；在空白處按住拖曳拉出選取框（Shift / Ctrl / ⌘ 加選）
// Enter 打開選取的 App，Ctrl/⌘+A 全選，Esc 或點空白處取消選取
import { $$, run } from './core';

const SKIP = '.win, .widgets, .menubar, .dock, .qs, .ctx, .launcher, .toasts, .power, .boot, a, button, input, textarea, select, label';

const icons = () => $$<HTMLElement>('.icons .icon');
export const selectedIcons = () => $$<HTMLElement>('.icons .icon.selected');
export function clearSelection() { selectedIcons().forEach((i) => i.classList.remove('selected')); }
function openIcons(list: HTMLElement[]) {
  list.forEach((i) => run(i.dataset.act || `open:${i.dataset.app}`));
  clearSelection();
}
export function selectAll() { icons().forEach((i) => i.classList.add('selected')); }

export function initSelect() {
  const box = document.createElement('div');
  box.className = 'marquee';
  box.hidden = true;
  document.body.append(box);

  addEventListener('pointerdown', (e) => {
    const target = e.target as Element;
    // 點圖示：只選它（加選鍵則切換）
    const icon = target.closest<HTMLElement>('.icons .icon');
    if (icon && e.button === 0) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) icon.classList.toggle('selected');
      else { clearSelection(); icon.classList.add('selected'); }
      return;
    }
    if (e.button !== 0 || e.pointerType === 'touch' || target.closest(SKIP)) return;

    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const before = new Set(additive ? selectedIcons() : []);
    if (!additive) clearSelection();
    // 輸入框失焦、避免拖曳時選到文字
    (document.activeElement as HTMLElement | null)?.blur();
    e.preventDefault();

    const x0 = e.clientX, y0 = e.clientY;
    const rects = icons().map((el) => [el, el.getBoundingClientRect()] as const);
    let moved = false;

    const move = (ev: PointerEvent) => {
      const x = Math.min(x0, ev.clientX), y = Math.min(y0, ev.clientY);
      const w = Math.abs(ev.clientX - x0), h = Math.abs(ev.clientY - y0);
      if (!moved && w < 4 && h < 4) return;
      if (!moved) { moved = true; box.hidden = false; document.body.classList.add('selecting'); }
      box.style.transform = `translate(${x}px, ${y}px)`;
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;
      for (const [el, r] of rects) {
        const hit = r.left < x + w && r.right > x && r.top < y + h && r.bottom > y;
        el.classList.toggle('selected', hit !== before.has(el));
      }
    };
    const up = () => {
      box.hidden = true;
      document.body.classList.remove('selecting');
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  });

  addEventListener('dblclick', (e) => {
    const icon = (e.target as Element).closest<HTMLElement>('.icons .icon');
    if (icon) openIcons([icon]);
  });

  addEventListener('keydown', (e) => {
    // 焦點在桌面上（不在視窗或輸入框裡）才處理
    const el = e.target as HTMLElement;
    if (el.matches('input, textarea, select, [contenteditable]') || el.closest('.win, .launcher, .power')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); return; }
    if (e.key !== 'Enter') return;
    const sel = selectedIcons();
    if (!sel.length && !el.matches('.icons .icon')) return;
    e.preventDefault();
    openIcons(sel.length ? sel : [el]);
  });
}
