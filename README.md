# Fusion Fuckery — card editor

A browser tool for designing the cards of the **Fusion Fuckery** trading card game: edit cards on their real
card frames, build decks, print A4 proxy sheets, and check balance.

**Open it online:** https://kleinstein-stack.github.io/fusion-fuckery/

## What it does

- **Edit cards** right on the card: name, attributes, text, ATK / HP / flux, type and faction.
  Filter by type (Creature, Fusion, Spell), faction or search, and zoom.
- **Change art**: hover a card's art → *Change art*, or drop an image on it. It's cropped to the frame automatically.
- **Cold storage**: hide cards from the main tabs without deleting them.
- **Deck builder** with the rulebook's limits (30-card Main Deck, up to 10 fusions, max 3 copies),
  flux curve, and **Export PDF (A4)**: 3×3 cards per page at real card size, optional card backs for double-sided printing.
- **📊 Analysis**: card checker (typos, broken numbers, fusion recipes that point at missing cards),
  balance chart (stats vs flux cost), faction depth and attribute crossover, version compare with patch notes,
  and an opening-hand simulator for the open deck.
- **Versions**: every save is kept; load or compare any earlier version.

## Saving

| Where you use it | Where Save goes |
|---|---|
| The website (link above) | Commits to this repo. Click **🔑 Sign in to save** once with a GitHub token (needs collaborator access). |
| Your own PC (see below) | `saves/` folder, and pushes to GitHub automatically if the folder is a git clone. |

Without signing in, the website is view-only: browsing, deck building, PDF export and analysis all work.

### Running it on your PC

1. Clone the repo (or download it as a ZIP).
2. Double-click **`start-editor.bat`**. It starts a small helper that only listens on your own PC and opens the editor.
   Leave its window open while editing.
3. Save writes to `saves/` and keeps a dated copy in `saves/versions/`.

## Files

| Path | What it is |
|---|---|
| `index.html` / `card-editor.html` | The editor (built — don't edit by hand) |
| `saves/Base set - Fusion Fuckery - v6.csv` | **The card list.** Opens fine in Excel / Google Sheets |
| `saves/versions/` | Earlier saves made on a PC |
| `saves/art-overrides.json` | Which custom art each card uses |
| `saves/decks.json` | Saved decks |
| `art/` | Card art cut from the finished card PNGs; `art/custom/` holds art added in the editor |
| `server.ps1`, `start-editor.bat`, `open-editor.ps1` | The local save helper |
| `tools/editor-template.html` | Editor source. Run `tools\build.ps1` after changing it |
| `tools/crop-art.ps1` | Re-cuts `art/` from a folder of finished card PNGs |
