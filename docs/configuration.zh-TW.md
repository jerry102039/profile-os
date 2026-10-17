# profile-os 設定說明

profile-os 網站上所有個人的東西都來自一個 **profile 資料夾**。要把網站變成你的，不需要改 `src/` 裡的程式。

[English version](configuration.md)

- [Profile 資料夾](#profile-資料夾)
- [profile.yaml](#profileyaml)
- [可多語的欄位](#可多語的欄位)
- [語言](#語言)
- [功能開關](#功能開關)
- [檔案：履歷、證照、圖片](#檔案履歷證照圖片)
- [環境變數](#環境變數)
- [部署](#部署)
- [從上游拉更新](#從上游拉更新)
- [新增一種語言](#新增一種語言)

## Profile 資料夾

```
profile/
  profile.yaml        所有個人內容、主題、要產生哪些 App 與語言
  notes/<語言>/        Markdown 筆記，例如 notes/en/hello.md → /notes/hello（或 /<代碼>/notes/hello）
  public/             原樣複製到網站根目錄（履歷、證照、頭像、截圖、favicon…）
```

用哪個資料夾，依序：

1. 環境變數 `PROFILE_DIR`（相對於 repo 或絕對路徑，可以放在 repo 外面）；
2. `profile/`（存在的話）；
3. `profile.example/`（repo 附的範例）。

`npm run build` 一開始會印出用的是哪個：`[profile] …/profile`。

先 `cp -r profile.example profile`。範例檔第一行會讓 VS Code 的 YAML 擴充套件讀取 `profile.schema.json`，編輯時就有自動完成與即時錯誤提示。

## profile.yaml

build 時用 zod 驗證。欄位寫錯會讓 build 失敗並印出路徑，例如 `owner.email: Invalid email`、`site.defaultLocale: must be one of site.locales (en, ja)`。

| 區塊 | 內容 |
| --- | --- |
| `site` | `name`（選單列、標題、分享圖上的作業系統名稱）、`url`（網域）、`version`、`logo`（開機畫面與分享圖的一兩個字）、`storageKey`（訪客瀏覽器記錄的前綴，改了訪客設定會歸零）、`defaultLocale`、`locales`、`theme.accents`（第一個是預設強調色） |
| `owner` | `name`、`username`（`/home/<username>` 與終端機提示字元）、`email`、`github`、`avatar`、`title`、`whoami`、`about`、`interests`、`status`、`description`（SEO）、`location`（天氣小工具預設地點）、`seo`（schema.org 的單位、地址、`knowsAbout`） |
| `resume` | `file`（在 `public/` 裡，預設 `resume.pdf`）與 `downloadName` |
| `pages` | 獨立頁 `/projects/`、`/notes/` 的介紹文字 |
| `projects` | 每個專案：`slug`、`title`、`desc`、`context`、`role`、`highlights`、`outcome`、`tags`，以及選用的 `image`、`arch`（ASCII 架構圖）、`links`、`timeline`、`tone` |
| `moreProjects` | 一行帶過的小專案：`name`、`desc` |
| `skills`、`skillsFooter` | 活動監視器視窗（`name`、`label`、`pct` 0–100、`tone`） |
| `contacts` | 聯絡人視窗（`label`、`value`、選用的 `href`） |
| `certSummary`、`certificates` | 終端機 `certs` 指令的摘要，以及證照牆（`id`、`file`、`issuer`、`title`） |
| `awards`、`oss`、`talks` | 同名終端機指令與 `~/Documents` 裡的清單 |
| `features` | 關掉部分功能，見[功能開關](#功能開關) |
| `startup` | 開機後依序打開的視窗，最後一個在最上面（手機只開最後一個） |
| `persona` | 小小的個人化：`lockPassword`、每年重複的 `calendar` 行程（`MM-DD`）、`matrixGlyphs`、`neofetchArt` |
| `ctf` | 隱藏解謎的 `flag` 與 `key`。兩個都要改，範例的是公開的 |

只有 `site`、`owner` 與 schema 標成必填的欄位一定要寫；清單預設是空的，功能預設全開。

## 可多語的欄位

大部分文字欄位可以寫一個值（所有語言共用）：

```yaml
title: Full-stack Developer
```

或依語言分開寫：

```yaml
title:
  en: Full-stack Developer
  ja: フルスタック開発者
  zh-Hant: 全端工程師
```

清單也一樣（`about`、`highlights`、`awards`…）。某語言沒寫時，依序使用：該語言 → 英文 → `site.defaultLocale` → 任何一個有的值。所以內容只寫一兩種語言，也可以開 10 種介面語言。

## 語言

```yaml
site:
  defaultLocale: en          # 放在 /
  locales: [en, ja, de]      # 要產生的所有語言
```

支援的代碼：`zh-Hant`、`en`、`zh-Hans`、`ja`、`ko`、`es`、`pt-BR`、`de`、`fr`、`ru`。

- 預設語言在 `/`，其他語言在 `/<小寫代碼>/`（`/ja/`、`/pt-br/`、`/zh-hant/`…）。這是 Astro 內建的 i18n 路由，`astro.config.mjs` 會讀你的 YAML 來設定。
- **系統介面**（選單、App、終端機、遊戲）每種語言都有翻譯；**你的內容**依上面的順序挑最適合的語言顯示。
- **SEO：** 內容真的有該語言版本的頁面，會輸出 `hreflang` 並列進 sitemap。fallback 的頁面（例如日文介面配英文專案說明）canonical 會指回原文那一頁，也不列進 sitemap，搜尋引擎不會把它們當成重複內容。
- **筆記**依語言分資料夾：`notes/en/hello.md`、`notes/ja/hello.md`。某語言沒有的筆記同樣會 fallback。
- 選單列與獨立頁都有語言選單，終端機有 `lang <代碼>`。訪客第一次來時，如果瀏覽器偏好另一個啟用中的語言，會提示一次可以切換（不會自動跳轉）。
- 只要一種語言？設 `locales: [en]`，語言選單與 `hreflang` 就會消失。
- 每種語言載入自己的 Noto 字型（TC、SC、JP、KR 或 Noto Sans）。拉丁／西里爾語系的頁面若有少數中日韓字（logo、名字），只會下載那幾個字。

## 功能開關

預設全開，只要寫你想關掉的：

```yaml
features:
  status: false                       # 不要 Homelab 監視器
  games: { snake: false, mines: false }
  easterEggs: false
```

| 開關 | 關掉什麼 |
| --- | --- |
| `finder` | 檔案總管 |
| `projects` | 專案視窗，**以及** `/projects/` 頁面、分享圖與 sitemap 項目 |
| `notes` | 筆記視窗，**以及** `/notes/` 頁面 |
| `skills` | 活動監視器（技能）視窗 |
| `status` | Homelab 監視器 |
| `taskmgr` | 工作管理員（`ps`／`kill` 仍可用） |
| `music` | 音樂播放器與相關終端機指令 |
| `calculator`、`calendar`、`contact`、`resume`、`certs`、`editor`、`appearance` | 該 App |
| `games.snake`、`games.dino`、`games.mines`、`games.g2048` | 各個遊戲；四個都關時 Games 資料夾與桌面圖示也會消失 |
| `widgets.weather`、`widgets.notes` | 桌面天氣小工具／便利貼 |
| `ctf` | 隱藏解謎：原始碼裡的提示、`.secret.enc`、`base64`／`unlock`／`hint`、選單列的旗子 |
| `bootAnimation` | 開機畫面 |
| `languageSwitcher` | 語言選單、`lang` 指令與首次造訪提示（各語言頁面仍然會產生） |
| `easterEggs` | Konami 秘技、`sl`、`cowsay`、`party`、`matrix`、kernel panic |

終端機、視窗管理、系統資訊與文字檢視器一定都在。被關掉的 App 會一次從所有地方消失：視窗、Dock、桌面圖示、選單、快速開啟（Ctrl+K）、檔案總管、終端機指令與 `help`、工作管理員，程式也不會被下載。`startup` 裡被關掉的視窗會跳過；一個都不剩就開終端機。

## 檔案：履歷、證照、圖片

檔案放在 `<profile>/public/`，網站會從根目錄提供。

| 檔案 | 放在哪 | 然後 |
| --- | --- | --- |
| 履歷 | `public/resume.pdf`（腳本只找這個檔名；`resume.file` 只影響下載連結） | `python scripts/certs-to-png.py` 會產生 `public/resume/<頁>.png`＋`.webp`＋`.sm.webp`，履歷視窗會顯示這些圖。沒有圖時退回 PDF 檢視器；連 PDF 都沒有時，視窗顯示一段「怎麼放」的說明，並隱藏下載按鈕。 |
| 證照 | `public/certs/<file>`（列在 `certificates`） | 同一支腳本會產生 `<id>.png`、`<id>.webp`、`<id>.thumb.jpg`、`<id>.thumb.webp` |
| 頭像 | `public/avatar.jpg` | `owner.avatar: /avatar.jpg` |
| 專案截圖 | `public/projects/*.jpg` | 專案的 `image: /projects/x.jpg` |
| favicon | `public/favicon.svg` | — |
| 搜尋引擎驗證檔 | 例如 `public/google123.html` | — |

腳本需要 `pip install pypdfium2`，找 profile 資料夾的順序跟 build 一樣（`PROFILE_DIR` → `profile/` → `profile.example/`）。

## 環境變數

把 `.env.example` 複製成 `.env`（或在主機後台設定）：

| 變數 | 用途 |
| --- | --- |
| `PROFILE_DIR` | 要 build 哪個 profile 資料夾 |
| `SITE_URL` | 蓋過 `site.url`（canonical、sitemap、分享圖） |
| `PUBLIC_STATUS_URL` | Homelab 監視器的即時資料（見 `homelab/README.md`）；留空就用 `public/status.json` 的示範資料 |
| `PUBLIC_CF_BEACON_TOKEN` | Cloudflare Web Analytics（不用 cookie）；留空就不載入 |

## 部署

`npm run build` 會把純靜態檔案輸出到 `dist/`，任何靜態主機都能放。三種常見做法：

1. **公開 fork、自動 build。** Fork 後 commit 你的 `profile/`（含 PDF），在 Cloudflare Workers & Pages 連接 repo（Build command `npm run build`、Output `dist`，或 Deploy command `npx wrangler deploy`）。最簡單，但你的檔案會公開在 GitHub。
2. **私人 repo，從上游拉更新**（作者自己的網站就是這樣做）。你網站的 repo 是私人的、裡面有 `profile/`；主機照常自動 build；引擎更新從這個 repo（設成 `upstream`）拉，見下一節。
3. **profile 不進 git。** profile 資料夾放在電腦任何地方，`PROFILE_DIR=/path/to/profile npm run build && npx wrangler deploy`。完全不會 commit 個人檔案，但要從自己電腦部署，不是 push 就自動上線。

第一次部署後，到 Google Search Console 提交 `https://你的網域/sitemap.xml`。

## 從上游拉更新

```bash
git remote add upstream https://github.com/jerry102039/profile-os.git
git pull upstream main
```

引擎從不碰 `profile/`，所以你的內容不會衝突。如果你刻意改了幾個引擎檔案的名稱（通常是 `wrangler.jsonc`、`package.json`、`homelab/wrangler.toml` 裡的 `name`），可以讓 git 永遠保留你的版本：

```bash
git config merge.ours.driver true
printf 'wrangler.jsonc merge=ours\npackage.json merge=ours\nhomelab/wrangler.toml merge=ours\n' >> .git/info/attributes
```

## 新增一種語言

1. 把 `src/i18n/locales/en.ts` 複製成 `src/i18n/locales/<代碼>.ts`，翻譯每個值（key、`{占位符}` 與終端機指令名稱不要動），並設定 `htmlLang`、`ogLocale`、`dateLocale`。
2. 在 `src/i18n/dict.ts` 登記，把代碼加進 `src/profile/schema.ts` 的 `LOCALES`，並在 `src/i18n/locale.ts` 與 `src/lib/fonts.ts` 加上它的原生名稱與字型。
3. 少任何一個 key，`npm run check` 都會失敗。最後把代碼加進你 profile 的 `site.locales`。

歡迎發 PR 新增或改進翻譯。
