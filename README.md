# typing-reply (personal fork)

A personal, offline fork of [lgordey/typing-reply](https://github.com/lgordey/typing-reply) (MIT). Got a voice message?
Reply with a video of hands slowly typing your answer on a phone. Everything runs on the device: there is no server,
and after the first visit the app works fully offline as a PWA.

## What's different from the original

- **Portrait video (720×1280)** showing the whole phone, including a chat header with the contact's name and photo.
- **Chat looks:** dark Telegram (the current iOS design with floating glass pills and a starry wallpaper, plus a dark
  keyboard), classic light Telegram, and iMessage.
- **Voice message length** is adjustable (3 s – 10 min) and drawn on the voice bubble. The video is at least as long as
  the voice message, capped at one minute.
- **Languages:** Russian and Uzbek. The Uzbek layout has a ʻ key for oʻ / gʻ. Uzbek Cyrillic letters (ў қ ғ ҳ) are typed
  with a long press on the Russian layout.
- **Removed:** watermark, end card, analytics, the Cloudflare Worker and the “about” texts.
- **Offline:** `vite.config.ts` generates `sw.js`, which precaches the whole build. The page is loaded network-first
  (2.5 s timeout), so updates show up on the next launch, while assets are served cache-first.
- Contact name, photo, voice length, typing mode and chat look are remembered in `localStorage`.

## Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev:phone    # HTTPS on your LAN (WebCodecs and Web Share need a secure context)
npm run build        # dist/ + sw.js
npm run preview      # check the build and the offline cache
npm test
npm run frames -- "Text" ru normal 0.5,3,end telegram-dark "Name" [photo.jpg] [voice_seconds]
npm run icons        # regenerate public/icon-*.png and apple-touch-icon.png
```

## Project layout

| Path | What |
|---|---|
| `src/timeline/` | text → key-press timeline (modes, typos, limits) |
| `src/keyboard/` | iOS-like layouts (ru, uz) and the keyboard simulator |
| `src/render/` | frame renderer: phone, chat themes (`chat.ts`), keyboard, hands |
| `src/encode/` | WebCodecs + Mediabunny MP4 encoder |
| `src/i18n/` | UI and in-video strings |
| `scripts/` | frame preview and icon generation |

## Hosting

Cloudflare Pages: build command `npm run build`, output directory `dist`, Node 22 (`.node-version`).
`public/_headers` disables caching for `sw.js` so updates reach the phone.

On iPhone, open the site in Safari → Share → Add to Home Screen, then launch it once while online.
Requires iOS 16.4+ (H.264 encoding via WebCodecs).

## License

MIT, see [LICENSE](LICENSE). Original work by the authors of
[lgordey/typing-reply](https://github.com/lgordey/typing-reply).
