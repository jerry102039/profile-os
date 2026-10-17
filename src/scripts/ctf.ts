// CTF：看原始碼 → ls -a → base64 → console 拿金鑰 → unlock
import { D, t, $, getPrefs, savePrefs } from './core';

export const ctfSolved = () => !!getPrefs().flag;

/** 用金鑰把密文 XOR 回來；格式對才算解開 */
export function tryUnlock(key: string): string | null {
  const k = new TextEncoder().encode(key.trim());
  if (!k.length) return null;
  const c = Uint8Array.from(atob(D.ctf.cipher), (ch) => ch.charCodeAt(0));
  const flag = new TextDecoder().decode(c.map((b, i) => b ^ k[i % k.length]));
  if (!/^FLAG\{[\x20-\x7e]+\}$/.test(flag)) return null;
  savePrefs({ flag: true });
  markSolved();
  return flag;
}

function markSolved() {
  $('#tray-flag').hidden = false;
  const f = $('#sys-flag');
  f.textContent = f.dataset.got ?? '🏁';
}

export function initCtf() {
  if (ctfSolved()) markSolved();
  const [title, found, keyLabel] = t.term.console;
  console.log(
    `%c${title}%c\n${found}\n${keyLabel}%c${D.ctf.keyHex}`,
    'font:900 28px monospace;color:#5dffa6;text-shadow:0 0 12px #5dffa6',
    'font:13px monospace;color:inherit',
    'font:700 13px monospace;color:#ffd166',
  );
}
