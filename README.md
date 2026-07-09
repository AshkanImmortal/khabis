# هفت خبیث — شمارشگر امتیاز (7 Khabis Score Keeper)

A tiny, dependency-free web app for keeping score in the Iranian card game **7 Khabis (هفت خبیث)**.

Everyone starts at zero. After each hand you tap a button and enter how much each
player's score went up (in this game the score is a penalty, so lower is better).
The moment a player reaches the **elimination score**, they're knocked out. The game
continues until one player remains — the **champion**.

## Features

- Set player names and the elimination score
- One tap per hand to enter everyone's points, with a live per-hand total
- Live scoreboard with progress toward elimination and the total of all players
- Automatic elimination and a final ranking / champion screen
- **Undo** the last hand if you mistyped
- **Auto-saves** to the browser, so a refresh never loses the game
- Full Persian (Farsi), right-to-left interface

## Run it

It's plain HTML/CSS/JS — no build step. Just open `index.html` in a browser, or
serve the folder with any static server:

```bash
python3 -m http.server
# then open http://localhost:8000
```

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
4. Choose branch **main** and folder **/ (root)**, then **Save**.
5. After a minute the site is live at `https://<username>.github.io/khabis/`.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup and screens |
| `styles.css` | Styling (RTL, card-table theme) |
| `engine.js` | Pure game logic (scoring, elimination, ranking) — no DOM |
| `app.js` | UI: rendering, inputs, localStorage |
