// nano：真的能編輯、能存檔的文字編輯器（寫進虛擬檔案系統，存在訪客的瀏覽器）
import { $, $$, t, toast, beep, pn } from '../core';
import { HOME, lookup, writeFile, resolve, pretty } from '../vfs';
import { openWin, closeWin, setTitle, isOpen } from '../wm';

const ta = $<HTMLTextAreaElement>('#ed-text');
const status = $('#ed-status');
const info = $('#ed-info');
const promptBox = $('#ed-prompt');
const promptLabel = $('#ed-prompt-label');
const promptInput = $<HTMLInputElement>('#ed-prompt-input');

let path: string | null = null;   // null = 還沒命名的新檔案
let saved = '';                   // 上次存檔的內容，用來判斷有沒有改過
let mode: 'edit' | 'name' | 'confirm' = 'edit';
let closeAfterSave = false;       // 從「離開 → 要存嗎？Y」進來的存檔，存完就關
const E = () => t.editor;

const dirty = () => ta.value !== saved;
const fileLabel = () => (path ? pretty(path) : E().newFile);
const lineCount = () => (ta.value ? ta.value.split('\n').length : 0);

function paint(msg?: string) {
  setTitle('editor', `nano — ${fileLabel()}${dirty() ? ' *' : ''}`);
  info.textContent = `${fileLabel()}${dirty() ? ` · ${E().modified}` : ''} · ${pn(E().lines, lineCount(), { c: ta.value.length })}`;
  if (msg !== undefined) status.textContent = msg;
}

function setMode(m: typeof mode, label = '', value = '') {
  mode = m;
  promptBox.hidden = m === 'edit';
  if (m === 'edit') { ta.focus(); return; }
  promptLabel.textContent = label;
  promptInput.value = value;
  promptInput.hidden = m === 'confirm';
  (m === 'confirm' ? promptBox : promptInput).focus();
  if (m === 'name') promptInput.select();
}

function write(target: string): boolean {
  const n = lookup(target);
  if (n && !n.user) { beep('error'); paint(E().denied); return false; }
  const err = writeFile(target, ta.value);
  if (err) { beep('error'); paint(err); return false; }
  path = target;
  saved = ta.value;
  paint(pn(E().saved, lineCount(), { file: pretty(target) }));
  if (closeAfterSave) { closeAfterSave = false; closeWin('editor'); }
  return true;
}

/** Ctrl+O：問檔名再存；Ctrl+S：有檔名就直接存 */
function save(ask: boolean) {
  if (!ask && path) { write(path); return; }
  setMode('name', E().prompt, path ? pretty(path) : '');
}

function exit() {
  if (dirty()) return setMode('confirm', E().confirm);
  closeWin('editor');
}

/** 開啟檔案（不存在就是新檔案；null = 空白新檔） */
export function openEditor(p: string | null) {
  path = p || null;
  const n = p ? lookup(p) : null;
  ta.value = n?.text ?? '';
  saved = n ? ta.value : '';
  closeAfterSave = false;
  setMode('edit');
  paint(n ? '' : p ? E().newFile : E().tip);
  openWin('editor', { hash: '' }).then(() => ta.focus());
}

export function initEditor() {
  ta.addEventListener('input', () => paint());
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); paint(); }
  });
  // nano 的快捷鍵：整個視窗都接
  $('#win-editor').addEventListener('keydown', (e) => {
    if (!isOpen('editor')) return;
    const k = e.key.toLowerCase();
    if (mode === 'confirm') {
      e.preventDefault();
      if (k === 'y') { closeAfterSave = true; setMode('edit'); save(!path); }
      else if (k === 'n') { saved = ta.value; closeWin('editor'); }
      else if (k === 'escape' || (e.ctrlKey && k === 'c')) setMode('edit');
      return;
    }
    if (mode === 'name') {
      if (k === 'enter') {
        e.preventDefault();
        const v = promptInput.value.trim();
        if (!v) return;
        const base = path ? path.slice(0, path.lastIndexOf('/')) || '/' : HOME;
        const target = resolve(base, v);
        if (lookup(target)?.kind === 'dir') { paint(`${v}: Is a directory`); return; }
        setMode('edit');
        write(target);
      } else if (k === 'escape' || (e.ctrlKey && k === 'c')) { e.preventDefault(); closeAfterSave = false; setMode('edit'); paint(''); }
      return;
    }
    if (e.ctrlKey && k === 'o') { e.preventDefault(); save(true); }
    else if (e.ctrlKey && k === 's') { e.preventDefault(); save(false); }
    else if (e.ctrlKey && k === 'x') { e.preventDefault(); exit(); }
    else if (e.ctrlKey && k === 'g') { e.preventDefault(); toast(E().tip, 'nano'); }
  });
  $$('#ed-keys [data-ed]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.ed;
    if (a === 'save') save(true);
    else if (a === 'exit') exit();
    else toast(E().tip, 'nano');
  }));
}
