# Configuring profile-os

Everything personal on a profile-os site comes from one **profile folder**. You should not need to touch the code in `src/` to make the site yours.

[繁體中文版](configuration.zh-TW.md)

- [The profile folder](#the-profile-folder)
- [profile.yaml](#profileyaml)
- [Localizable fields](#localizable-fields)
- [Languages](#languages)
- [Feature switches](#feature-switches)
- [Files: résumé, certificates, images](#files-résumé-certificates-images)
- [Environment variables](#environment-variables)
- [Deploy](#deploy)
- [Getting updates from upstream](#getting-updates-from-upstream)
- [Add a language](#add-a-language)

## The profile folder

```
profile/
  profile.yaml        all personal content, the theme, which apps and languages to build
  notes/<language>/   Markdown notes, e.g. notes/en/hello.md → /notes/hello (or /<code>/notes/hello)
  public/             copied as-is to the site root (résumé, certificates, avatar, screenshots, favicon…)
```

Which folder is used, in order:

1. the `PROFILE_DIR` environment variable (relative to the repo or an absolute path — it can live outside the repository);
2. `profile/` if it exists;
3. `profile.example/` (the example that ships with the repo).

The first lines of `npm run build` print the folder in use: `[profile] …/profile`.

Start with `cp -r profile.example profile`. The example's first line points VS Code's YAML extension at `profile.schema.json`, so you get autocompletion and inline errors while editing.

## profile.yaml

The file is validated with zod when the site builds. A wrong field fails the build and prints its path, for example `owner.email: Invalid email` or `site.defaultLocale: must be one of site.locales (en, ja)`.

| Section | What it holds |
| --- | --- |
| `site` | `name` (the OS name in the menu bar, titles and share images), `url` (your domain), `version`, `logo` (one or two characters for the boot screen and share images), `storageKey` (prefix for what visitors' browsers remember — changing it resets their settings), `defaultLocale`, `locales`, `theme.accents` (the first is the default accent colour) |
| `owner` | `name`, `username` (`/home/<username>` and the terminal prompt), `email`, `github`, `avatar`, `title`, `whoami`, `about`, `interests`, `status`, `description` (SEO), `location` (weather widget default), `seo` (affiliation, address, `knowsAbout` for schema.org) |
| `resume` | `file` (in `public/`, default `resume.pdf`) and `downloadName` |
| `pages` | intro text of the standalone `/projects/` and `/notes/` pages |
| `projects` | each with `slug`, `title`, `desc`, `context`, `role`, `highlights`, `outcome`, `tags`, optional `image`, `arch` (ASCII diagram), `links`, `timeline`, `tone` |
| `moreProjects` | one-line extras: `name` and `desc` |
| `skills`, `skillsFooter` | the Activity Monitor window (`name`, `label`, `pct` 0–100, `tone`) |
| `contacts` | the Contacts window (`label`, `value`, optional `href`) |
| `certSummary`, `certificates` | text for the terminal's `certs` command, and the certificate gallery (`id`, `file`, `issuer`, `title`) |
| `awards`, `oss`, `talks` | lists for the terminal commands of the same name and `~/Documents` |
| `features` | switch parts of the desktop off — see [Feature switches](#feature-switches) |
| `startup` | windows opened after boot, in order; the last ends up on top (phones only open the last one) |
| `persona` | small personal touches: `lockPassword`, recurring `calendar` events (`MM-DD`), `matrixGlyphs`, `neofetchArt` |
| `ctf` | `flag` and `key` of the hidden capture-the-flag puzzle — change both, the example's are public |

Only `site`, `owner` and the fields marked required in the schema are mandatory; lists default to empty and every feature defaults to on.

## Localizable fields

Most text fields accept either one value for every language:

```yaml
title: Full-stack Developer
```

or one value per language:

```yaml
title:
  en: Full-stack Developer
  ja: フルスタック開発者
  zh-Hant: 全端工程師
```

Lists work the same way (`about`, `highlights`, `awards`…). When a language is missing, the site uses, in order: that language → English → `site.defaultLocale` → whichever value exists. So you can write your content in one or two languages and still enable all ten UI languages.

## Languages

```yaml
site:
  defaultLocale: en          # served at /
  locales: [en, ja, de]      # every language to build
```

Supported codes: `zh-Hant`, `en`, `zh-Hans`, `ja`, `ko`, `es`, `pt-BR`, `de`, `fr`, `ru`.

- The default language lives at `/`; the others at `/<code in lowercase>/` (`/ja/`, `/pt-br/`, `/zh-hant/`…). This is Astro's built-in i18n routing, configured from your YAML in `astro.config.mjs`.
- The **system UI** (menus, apps, terminal, games) is translated for every language. **Your content** is shown in the best available language as described above.
- **SEO:** a page whose content really exists in that language gets `hreflang` links and a sitemap entry. A page that falls back (say, a Japanese page showing your English project description) points its canonical URL to the original language and stays out of the sitemap, so search engines don't see duplicates.
- **Notes** are per language: `notes/en/hello.md`, `notes/ja/hello.md`. A note missing in a language falls back like other content.
- A language menu appears in the menu bar and on the standalone pages; the terminal has `lang <code>`. On a visitor's first visit, if their browser prefers another enabled language, a one-time hint offers to switch (it never redirects on its own).
- One language only? Set `locales: [en]` — the language menu and `hreflang` disappear.
- Each language loads its own Noto font (TC, SC, JP, KR or Noto Sans). Latin/Cyrillic pages that show a few CJK characters (your logo, your name) download just those characters.

## Feature switches

Everything is on by default; list only what you want to turn off:

```yaml
features:
  status: false                       # no homelab monitor
  games: { snake: false, mines: false }
  easterEggs: false
```

| Switch | Turns off |
| --- | --- |
| `finder` | the file manager |
| `projects` | the projects windows **and** the `/projects/` pages, their share images and sitemap entries |
| `notes` | the notes window **and** the `/notes/` pages |
| `skills` | the Activity Monitor (skills) window |
| `status` | the homelab monitor |
| `taskmgr` | the task manager (`ps`/`kill` still work) |
| `music` | the music player and its terminal commands |
| `calculator`, `calendar`, `contact`, `resume`, `certs`, `editor`, `appearance` | that app |
| `games.snake`, `games.dino`, `games.mines`, `games.g2048` | each game; with all four off the Games folder and icon disappear |
| `widgets.weather`, `widgets.notes` | the desktop weather widget / sticky notes |
| `ctf` | the hidden puzzle: the source comment, `.secret.enc`, `base64`/`unlock`/`hint`, the flag in the menu bar |
| `bootAnimation` | the boot screen |
| `languageSwitcher` | the language menu, the `lang` command and the first-visit hint (the language pages are still built) |
| `easterEggs` | Konami code, `sl`, `cowsay`, `party`, `matrix`, the kernel panic |

The terminal, window manager, system information and text viewer are always there. A disabled app disappears everywhere at once — window, Dock, desktop icon, menus, launcher (Ctrl+K), file manager, terminal commands, `help`, task manager — and its code is never downloaded. Windows listed in `startup` that are turned off are skipped; if none is left, the terminal opens.

## Files: résumé, certificates, images

Put files in `<profile>/public/`; they are served from the site root.

| File | Where | Then |
| --- | --- | --- |
| Résumé | `public/resume.pdf` (the script looks for this name; `resume.file` only changes the download link) | `python scripts/certs-to-png.py` renders `public/resume/<page>.png` + `.webp` + `.sm.webp`, which the résumé window shows. Without images it falls back to the PDF viewer; without a PDF it shows a short "how to add one" note and hides the download button. |
| Certificates | `public/certs/<file>` (listed in `certificates`) | the same script makes `<id>.png`, `<id>.webp`, `<id>.thumb.jpg`, `<id>.thumb.webp` |
| Avatar | `public/avatar.jpg` | `owner.avatar: /avatar.jpg` |
| Project screenshots | `public/projects/*.jpg` | `image: /projects/x.jpg` on the project |
| Favicon | `public/favicon.svg` | — |
| Search-engine verification | e.g. `public/google123.html` | — |

The script needs `pip install pypdfium2` and uses the same folder rules as the build (`PROFILE_DIR` → `profile/` → `profile.example/`).

## Environment variables

Copy `.env.example` to `.env` (or set them on your host):

| Variable | Purpose |
| --- | --- |
| `PROFILE_DIR` | which profile folder to build |
| `SITE_URL` | overrides `site.url` (canonical URLs, sitemap, share images) |
| `PUBLIC_STATUS_URL` | live data for the homelab monitor (see `homelab/README.md`); empty = demo data from `public/status.json` |
| `PUBLIC_CF_BEACON_TOKEN` | Cloudflare Web Analytics (cookie-free); empty = not loaded |

## Deploy

`npm run build` writes plain static files to `dist/`; any static host works. Three common setups:

1. **Public fork, auto-build.** Fork, commit your `profile/` (PDFs included), connect the repo to Cloudflare Workers & Pages (build command `npm run build`, output `dist`, or deploy command `npx wrangler deploy`). Simple, but your files are public on GitHub.
2. **Private repo that pulls updates from upstream** (how the author runs their own site). Your site's repository is private and contains `profile/`; the host builds it automatically; engine updates come from this repo as `upstream` — see below.
3. **Profile outside git.** Keep the profile folder anywhere on your machine, then `PROFILE_DIR=/path/to/profile npm run build && npx wrangler deploy`. Nothing personal is ever committed, but you deploy from your computer instead of on push.

After the first deploy, submit `https://your.domain/sitemap.xml` to Google Search Console.

## Getting updates from upstream

```bash
git remote add upstream https://github.com/jerry102039/profile-os.git
git pull upstream main
```

The engine never touches `profile/`, so your content never conflicts. If you renamed a few engine files on purpose — typically the `name` in `wrangler.jsonc`, `package.json` or `homelab/wrangler.toml` — tell git to always keep your version:

```bash
git config merge.ours.driver true
printf 'wrangler.jsonc merge=ours\npackage.json merge=ours\nhomelab/wrangler.toml merge=ours\n' >> .git/info/attributes
```

## Add a language

1. Copy `src/i18n/locales/en.ts` to `src/i18n/locales/<code>.ts`, translate the values (keep the keys, the `{placeholders}` and the terminal command names), and set `htmlLang`, `ogLocale` and `dateLocale`.
2. Register it in `src/i18n/dict.ts`, add the code to `LOCALES` in `src/profile/schema.ts`, and add its native name and font in `src/i18n/locale.ts` and `src/lib/fonts.ts`.
3. `npm run check` fails until every key is present. Then add the code to `site.locales` in your profile.

Pull requests with new or improved translations are welcome.
