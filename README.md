# German Wordwall — Flashcards

A tiny web app for flipping German ↔ English cards. Works offline-ish (static files), swipe up/down like those short-video apps, and bookmarks per-dataset. 😄


## Quick run (dev)

1. Open a terminal in the project folder (`/Users/omar/Desktop/German`).
2. Start a simple static server (python):

```bash
python3 -m http.server 8000
```

3. Open your browser to `http://localhost:8000` and enjoy the cards.

## How it works (short)

- Data files are plain text under `mnt/data/` (e.g. `file-3.txt`, `file-3-verbs.txt`).
- The app fetches the current file (`currentFile`) and parses it into themes/cards.
- Bookmarks, index and scores are stored separately per dataset in `localStorage`.
- Use the `V-Perfekt` button in the header to toggle the verbs dataset.

## Mobile tips

- The UI is optimized for mobile: full-screen cards, TikTok-style vertical swipes.
- If swipe feels off on iOS, try in Safari or enable mobile emulation in Chrome devtools.

## Files you may care about

- `index.html` — markup
- `styles.css` — styling (mobile tweaks live here)
- `script.js` — main app logic (parsing, rendering, gestures, storage)
- `mnt/data/` — where the vocab text files live

## Add your own dataset

Drop a new text file into `mnt/data/` and add a small header button in `index.html` (or I can add a dropdown for you). Button needs `data-file="/mnt/data/your-file.txt"`.

## Want me to do more?

- Add a dataset selector UI (dropdown) to choose between all files automatically.
- Persist last-chosen dataset across reloads.
- Add small CSS animations for drag/interactions.

Enjoy — and tell me if you want the README more formal or less typo-ey 😅
