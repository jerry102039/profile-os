# profile-os

一個長得像作業系統的個人網站：開機畫面、可拖曳的視窗、真的能打字的終端機、檔案系統能寫的檔案總管、音樂播放器、小遊戲、桌面小工具、深淺色主題，而且有 **10 種介面語言**。用 [Astro](https://astro.build) 和原生 TypeScript 做成的純靜態網站，沒有前端框架。

**Fork 回去就能變成你自己的 OS。** 所有個人內容都在一個資料夾裡：一份 `profile.yaml`、你的 PDF 和筆記。要顯示哪些 App、要產生哪些語言，都不用改程式。

線上範例（範例人物）：**[profile-os.linjerry102039.workers.dev](https://profile-os.linjerry102039.workers.dev)** · [English README](../README.md) · [設定說明](configuration.zh-TW.md)

![profile-os 示範：終端機、專案視窗、快速開啟、小遊戲、換桌布、切換成日文](demo.gif)

## 特色

- **一份 YAML。** 名字、專案、技能、聯絡方式、證照、主題色、開機後打開哪些視窗、功能開關，全部寫在 `profile/profile.yaml`，build 時會驗證（打錯欄位會直接失敗並告訴你是哪一欄）。附 JSON Schema，VS Code 裡打字就有提示。
- **10 種介面語言。** English、繁體中文、简体中文、日本語、한국어、Español、Português (Brasil)、Deutsch、Français、Русский，用 Astro 內建的 i18n 路由。預設語言在 `/`，其他語言在 `/ja/`、`/de/`……。你的內容想寫幾種語言都可以，沒寫的會先用英文。語言選單、`hreflang`、各語言字型、「本站也有你的語言」的一次性提示都內建。
- **自己挑 App。** Homelab 監視器、小遊戲、CTF 解謎、彩蛋……都能一行關掉；關掉的 App 會從 Dock、選單、終端機和檔案總管一起消失，程式也不會被下載。
- **快。** 純靜態 HTML，桌面核心 JS 約 29 KB（gzip），每頁只下載自己那種語言（一個可快取的小 JSON 檔）。每個 App 各自 1～4 KB，第一次打開才下載。
- **履歷優先。** 可以讓訪客一進來就看到履歷視窗（轉成清楚的頁面圖片），終端機在後面。`/#projects/xxx` 這類深層連結會直接開視窗、跳過開機動畫。
- **真的終端機。** `ls`、`cd`、`cat`、`mkdir`、`touch`、`rm`、`mv`、`cp`、`echo > file`、`nano`（能存檔）、`grep`、`find`、`tree`、`ps`、`kill`、`neofetch`、`ping`（真的量延遲）、`lang`、Tab 補完、歷史。
- **App 與遊戲。** 終端機、檔案總管、專案、筆記、技能、工作管理員（即時效能圖）、Homelab 監視器、音樂播放器（WebAudio 即時合成）、計算機、行事曆、聯絡人、證照牆、文字編輯器、外觀設定，以及貪食蛇、小恐龍、踩地雷、2048。
- **外觀。** 9 套配色、自訂強調色、7 種動態桌布、淺色／深色／跟隨系統、天氣與便利貼小工具。
- **SEO 都做好了。** 每個專案、每篇筆記都有獨立網址和分享預覽圖；sitemap、robots.txt、canonical／hreflang、schema.org JSON-LD 自動產生。

## 快速開始

```bash
git clone https://github.com/jerry102039/profile-os my-os
cd my-os
npm install
cp -r profile.example profile     # 複製一份範例當成你自己的 profile
npm run dev                       # http://localhost:4321
```

接著改 `profile/profile.yaml`。每個欄位都有註解，[設定說明](configuration.zh-TW.md)逐一解釋各區塊、功能開關、語言與部署方式。

其他指令：`npm run build`（輸出到 `dist/`）、`npm run preview`、`npm run check`（型別檢查）、`npm test`、`npm run schema`（重新產生 `profile.schema.json`）。

需要 Node 20 以上。build 時會向 Google Fonts 下載字型子集來產生分享預覽圖，所以需要能上網。

## 讓 AI 幫你寫 profile.yaml

`profile.yaml` 不用自己一欄一欄填。Claude、ChatGPT、Gemini 這類 AI 助理都能根據你的履歷，在一分鐘內寫出初稿。

1. 開一個新對話，附上（或貼上）三樣東西：[`profile.example/profile.yaml`](../profile.example/profile.yaml)（格式與註解）、[`profile.schema.json`](../profile.schema.json)（完整規則），以及你的履歷（PDF，或 LinkedIn、GitHub 個人頁、CV 的文字）。
2. 把下面的提示詞裡 `<尖括號>` 的部分改成你的需求，送出。
3. 把 AI 的回答存成 `profile/profile.yaml`，執行 `npm run dev`（或 `npm run check`）。
4. 如果 build 出現像 `owner.email: Invalid email` 這樣的錯誤，把那幾行貼回對話，請 AI 只修那幾個欄位。schema 會指出每個寫錯的欄位，通常改一次就好。
5. **發布前一定要自己看過一遍。** 這份檔案的所有內容都會出現在公開網站上：確認沒有 AI 編造的內容，也拿掉你不想公開的資料（電話、住址、生日……）。

```text
請幫我寫 profile-os 的 profile.yaml。profile-os 是一個長得像桌面作業系統的個人網站。
附件：profile.example/profile.yaml（格式與註解）、profile.schema.json（必須通過的 schema），以及我的履歷。

請寫出完整的 profile.yaml：
- 保留範例的結構、欄位名稱與註解，把 Alex Rivera 的內容換成我的。
- 只能用我履歷裡的事實，不要編造工作經歷、數字、日期、連結或證照；
  不確定的選填欄位直接省略，不要猜。
- site：name「<我的 OS 名稱，例如 alexOS>」、url「<https://我的網域>」、logo「<一兩個字>」、
  storageKey「<小寫英文名稱>」、defaultLocale <zh-Hant>、locales [<zh-Hant, en, …>]。
- owner.username：終端機用的小寫英文短名稱（例如 "alex"）。
- 內容用 <繁體中文> 寫（需要英文版時，用 { zh-Hant: …, en: … } 的寫法分開寫）。
  文字要短，因為會顯示在小視窗裡。
- projects：挑我最強的 2～6 個專案，每個都要有 title、desc、context、role、highlights、
  outcome、tags；其他的放進 moreProjects。
- skills：4～6 項，pct（0～100）要誠實。
- features：維持預設，除了 <例如 status: false、ctf: false>。
- 不要放我的電話和住址。
- 只回覆 YAML，放在一個 code block 裡。
```

在 repo 裡用 AI 寫程式工具（Claude Code、Cursor、Copilot…）的話，更簡單：把履歷放進資料夾，然後說：「讀 docs/configuration.zh-TW.md 和 profile.example/profile.yaml，根據 resume.pdf 建立 profile/profile.yaml。只用履歷裡的事實、不要放我的電話，然後執行 `npm run check` 直到通過。」它會自己跑 build、修正自己的錯誤。

## Profile 資料夾

```
profile/
  profile.yaml        所有個人內容＋要產生哪些 App 與語言
  notes/en/*.md       筆記，每種語言一個資料夾（notes/ja/、notes/zh-Hant/…）
  public/             原樣放到網站根目錄：resume.pdf、certs/*.pdf、avatar.jpg、favicon.svg…
```

build 會用環境變數 `PROFILE_DIR` 指定的資料夾，沒設定就用 `profile/`，再沒有就用 `profile.example/`。

把 `resume.pdf` 和 `certs/<檔名>.pdf` 放進 `profile/public/`，跑 `python scripts/certs-to-png.py`（需要 `pip install pypdfium2`），產生履歷與證照視窗用的頁面圖片。

**不想讓 PDF 進 git？** 把 profile 資料夾放在 repo 外面，用 `PROFILE_DIR` 指過去，見[部署方式](configuration.zh-TW.md#部署)。

## 部署

`dist/` 是純靜態檔案，任何靜態主機都能放。Cloudflare（Workers & Pages → 建立 → 連接到 Git）：Build command `npm run build`、Output directory `dist`（或 Deploy command `npx wrangler deploy`，會讀 `wrangler.jsonc`）。網址跟 profile 的 `site.url` 不同時，設定環境變數 `SITE_URL`。私人 repo 的做法與其他細節見[設定說明](configuration.zh-TW.md#部署)。

## 翻譯

介面字串在 `src/i18n/locales/<代碼>.ts`，TypeScript 會用 `en.ts` 檢查（少一個 key，`npm run check` 就會失敗）。繁中以外的非英文字典是機器輔助翻譯，**非常歡迎母語者發 PR 修正**。新增語言的步驟見[設定說明](configuration.zh-TW.md#新增一種語言)。

## 授權

[MIT](../LICENSE)。範例 profile 可以自由使用；如果你是從別人的網站 fork，請把對方的個人內容（履歷、證照、照片、文章）換成你自己的。
