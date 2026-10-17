// 進入點：先下載目前語言的字典（/i18n/<代碼>.<hash>.json），再載入桌面。
// 字典不內嵌在 HTML 裡，首次繪製比較快；開機動畫期間就下載完了。
const data = JSON.parse(document.getElementById('os-data')!.textContent!) as { dict: string };

(async () => {
  let dict: unknown;
  for (let i = 0; i < 3 && !dict; i++) {
    try { dict = await (await fetch(data.dict)).json(); } catch { await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
  // 部署新版後舊分頁可能拿不到舊字典 → 重新整理拿新版
  if (!dict) { location.reload(); return; }
  (window as unknown as { __osT: unknown }).__osT = dict;
  await import('./main');
})();
