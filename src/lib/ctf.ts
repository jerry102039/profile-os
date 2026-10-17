// CTF：只在 build 時（Astro frontmatter）使用，flag 明文不會出現在送到瀏覽器的檔案裡。
// 瀏覽器只拿到「flag XOR 金鑰」的密文，以及藏在 console 的金鑰 hex。flag 與金鑰寫在 profile.yaml 的 ctf。
import { profile } from '../profile';

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const toHex = (s: string) => Array.from(enc.encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

function xorB64(text: string, key: string) {
  const t = enc.encode(text);
  const k = enc.encode(key);
  return b64(t.map((b, i) => b ^ k[i % k.length]));
}

const c = profile.ctf;
export const ctf = {
  keyHex: c ? toHex(c.key) : '',
  cipher: c ? xorB64(c.flag, c.key) : '',
  secretB64: (msg: string) => b64(enc.encode(msg)),
};
