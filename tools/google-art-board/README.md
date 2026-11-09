# Fusion Fuckery Art Board on Google

The art board as a Google Apps Script web app, shown on a Google Sites page. Artists submit art through the Google
Form; the board shows each card's current look, stats, card text and art brief, and the art you approve.

- **Cards, stats, card text, art briefs, placeholder art and card previews** come from this GitHub repo, so the
  board follows the card editor (within about 10 minutes of a push).
- **Submissions** come from the form's response Sheet. A submission only shows once you type `yes` in its
  **Approved** column. Only then is that art file made viewable by link; nothing else in your Drive is shared.
- **Email addresses and notes** never leave the script. The page only gets the credit name and the
  "Where can people find your work?" link of approved art.

## One-time setup

1. **Make the response Sheet private again.** In the Sheet: Share > General access > **Restricted**. The script
   reads it as you, so nobody else needs access.
2. **Add the Approved column.** In the Sheet's responses tab, type `Approved` in the first empty header cell on the
   right. Later, per submission: `yes` shows it, `no` hides it, empty means "in review".
3. **Open Apps Script from the Sheet.** Extensions > **Apps Script**.
   - Replace everything in `Code.gs` with the contents of [`Code.gs`](Code.gs).
   - Click **+** next to Files > **HTML**, name it `Board` (exactly), and replace its contents with
     [`Board.html`](Board.html).
   - Click **Save**.
4. **Deploy it.** Deploy > **New deployment** > the gear > **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone** (anyone can view the board without signing in), or **Anyone with a Google
     account**.
   - Click **Deploy**, then **Authorize access**. Google warns that the app isn't verified, because it's your own
     script: click Advanced > Go to (your project) > Allow. It asks for Sheets (to read submissions), Drive (to share
     approved art by link) and external requests (to read the cards from GitHub).
   - Copy the **Web app URL** and open it to check the board loads.
5. **Put it on Google Sites.** sites.google.com > Blank site > Insert > **Embed** > By URL > paste the web app URL >
   Insert. Drag the embed to full width and make it tall. Then **Publish** and choose who can view the site.
   (You can also just share the web app URL; the Site is a nicer front door.)

## Day to day

- **New submission:** open the Drive folder "(File responses)" or the file link in the Sheet, look at the art,
  and type `yes` or `no` in Approved. The board shows it on the next reload.
- **"Is this the finished art?"** Approved finished art marks the card **Art done**. An approved sketch marks it
  **In progress**. Unapproved submissions show **In review**, without a name or image.
- **Alternative versions:** type `alt` in Approved instead of `yes`. The card keeps its main art, and a
  **Next version** button on the board steps through the others (Spell Slinger's cloak colours, for example).
- **Finished art going into the editor:** the board's left-hand preview always shows the placeholder art. Before you
  put a card's finished art into the editor, add its current art path to `saves/placeholder-art.json`
  (`"Card name": "art/…"`), so the board keeps showing the placeholder.
- **Cards changed?** Card text, stats, briefs and placeholder art update by themselves once they're on GitHub.
  The rendered card previews don't: run `tools\art-previews.ps1` (or `-Only "Card A,Card B"`), and the editor's
  next save (or a push) uploads them.
- **Changed the form?** If you rename the card question or rebuild the form, update `FORM_URL` and `CARD_FIELD` at
  the top of `Code.gs` from a new pre-filled link, then Deploy > Manage deployments > edit > Version: New version.
- **Changed the code?** Paste it in again, then Deploy > Manage deployments > edit (pencil) > Version: **New
  version** > Deploy. The URL stays the same.
