# second-brain-app

A personal "second brain" web app for my phone. It runs on my own laptop and shows
mini-apps (deadlines, grades, quick notes, birthdays, an English conversation partner)
built on top of my [Obsidian](https://obsidian.md) vault.

It is a PWA: open it in Safari on the iPhone, tap **Share → Add to Home Screen**,
and it behaves like a native app (own icon, full screen, no App Store).

## Status

- [x] Home screen with mini-app tiles, iPhone-ready (safe areas, home-screen icon)
- [x] Server health indicator
- [x] Deadlines with countdown (read-only from the vault, last data kept on the phone)
- [ ] Grade tables (read-only from the vault)
- [ ] Offline mode (last synced data when the laptop is off)
- [ ] Quick note → Obsidian
- [ ] Birthdays → iPhone Calendar (.ics)
- [ ] English conversation practice (Claude API)

## Run

Requires Node.js 22+ (no npm packages needed).

```bash
cp config.example.json config.json   # then edit host, port and vaultPath
node server.js
```

Then open `http://<host>:<port>` on the phone (same network).

`host` decides who can reach the app. Use `127.0.0.1` for this computer only, or the
address of a private network (e.g. a laptop hotspot or Tailscale). Do not use a public network address.

## Project structure

```
server.js              small HTTP server (Node.js built-ins only)
config.example.json    settings template (config.json is git-ignored)
public/
  index.html           home screen
  style.css            design tokens and layout
  app.js               date, greeting, server status
  manifest.webmanifest PWA metadata
  icons/               home-screen icons
```

## Privacy

Personal data (grades, deadlines, notes) is never stored in this repository.
The app reads it at runtime from the local Obsidian vault configured in `config.json`.
