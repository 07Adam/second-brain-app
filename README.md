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
- [x] Grade tables (read-only from the vault, any note with a "## Moje body" section)
- [x] Offline mode (service worker + last synced data when the laptop is off)
- [ ] Quick note → Obsidian
- [ ] Birthdays → iPhone Calendar (.ics)
- [ ] English conversation practice (Claude API)

## Run

Requires Node.js 22+ (no npm packages needed).

```bash
cp config.example.json config.json   # then edit host, port and vaultPath
node server.js
```

Keep `host` set to `127.0.0.1`, so the server is reachable only from this computer.

### Reach it from the phone (HTTPS via Tailscale)

The offline mode uses a service worker, and iOS allows service workers only over HTTPS.
[Tailscale Serve](https://tailscale.com/kb/1312/serve) gives the app an HTTPS address that
works only inside your own tailnet (not on the public internet):

1. Install Tailscale on the laptop and the phone and sign in with the same account.
2. In the Tailscale admin console, enable **MagicDNS** and **HTTPS certificates** (DNS page).
3. On the laptop:

   ```bash
   sudo tailscale serve --bg 3000
   ```

4. Open `https://<machine>.<tailnet>.ts.net` in Safari on the phone and add it to the home screen.

Do not use `tailscale funnel` — that would publish the app on the internet.

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
