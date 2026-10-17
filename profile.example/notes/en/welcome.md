---
title: Make this desktop yours
description: Copy the example profile, edit one YAML file, drop in your PDFs, and deploy.
date: 2026-10-17
tags: [profile-os, setup]
---

Everything personal on this site comes from one folder.

1. Copy the example: `cp -r profile.example profile`
2. Edit `profile/profile.yaml` — your name, projects, skills, contacts and which apps to show.
3. Put your résumé and certificates in `profile/public/` and run `python scripts/certs-to-png.py`.
4. Write notes as Markdown in `profile/notes/<language>/`.
5. `npm run dev`, then deploy.

The full reference is in `docs/configuration.md`.
