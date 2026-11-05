/**
 * Fusion Fuckery Art Board, served as a Google Apps Script web app.
 *
 * The cards (names, stats, card text), the art briefs, the placeholder art and the card previews come from the
 * public GitHub repo, so the board follows the card editor. Submissions come from the art submission form's
 * response Sheet. A submission only shows once its row says "yes" in the Approved column, and only then is its
 * art file made viewable by link. Email addresses and notes never leave this script.
 * Setup: tools/google-art-board/README.md
 */
const CONFIG = {
  SHEET_ID: '1ypa6rIN9JyrZcJ-AkVTm4Hxt1zfoEE4GB4kgd7bwXmk',
  FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLScUZeuWfZipHupOv9_pCVeIITVpRS3lsLMg-40WWvBwusL4Kw/viewform',
  CARD_FIELD: 'entry.711793173',   // the form's "Which card is this art for?" question, from its pre-filled link
  REPO: 'https://raw.githubusercontent.com/kleinstein-stack/fusion-fuckery/main/',
  CACHE_SECONDS: 600,              // how long card data from GitHub is reused before it's fetched again
  CLAIM_DAYS: 5,                   // a claim with no art drops back to "Needs art" after this many days (0 = never)
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Board')
    .setTitle('Fusion Fuckery Art Board')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);   // lets Google Sites embed it
}

/** Everything the page shows, in one call from the page. */
function getBoard() {
  return { cards: getCards_(), art: getSubmissions_(), formUrl: CONFIG.FORM_URL, cardField: CONFIG.CARD_FIELD, repo: CONFIG.REPO };
}

// ---- cards from GitHub ----
function fetchText_(path) {
  const cache = CacheService.getScriptCache(), key = 'gh:' + path;
  const hit = cache.get(key);
  if (hit !== null) return hit;
  const url = CONFIG.REPO + path.split('/').map(encodeURIComponent).join('/');
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not load ' + path + ' from GitHub (' + res.getResponseCode() + ').');
  const text = res.getContentText('UTF-8').replace(/^﻿/, '');
  try { cache.put(key, text, CONFIG.CACHE_SECONDS); } catch (e) { /* over the cache's 100 KB limit: just not cached */ }
  return text;
}

/** RFC 4180 CSV: quoted fields may hold commas, doubled quotes and line breaks. */
function parseCsv_(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

function slug_(name) {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function artMap_() {
  const js = fetchText_('art/art.js'), m = js.match(/window\.CARD_ART\s*=\s*(\{[\s\S]*\})/);
  const map = m ? JSON.parse(m[1]) : {};
  try { Object.assign(map, JSON.parse(fetchText_('saves/art-overrides.json'))); } catch (e) {}
  return map;
}

function briefMap_() {
  const out = {};
  try { parseCsv_(fetchText_('saves/art-briefs.csv')).slice(1).forEach(r => { if (r[0]) out[r[0].trim()] = (r[1] || '').trim(); }); } catch (e) {}
  return out;
}

function getCards_() {
  const rows = parseCsv_(fetchText_('saves/Base set - Fusion Fuckery - v6.csv'));
  const head = rows[0].map(s => s.trim()), col = name => head.indexOf(name);
  const get = (r, name) => (col(name) >= 0 ? r[col(name)] || '' : '').trim();
  const art = artMap_(), briefs = briefMap_(), cards = [];
  rows.slice(1).forEach(r => {
    const name = get(r, 'Name');
    if (!name || /^(yes|y|true|1|x)$/i.test(get(r, 'Cold Storage'))) return;
    const type = get(r, 'Type'), faction = get(r, 'Faction');
    cards.push({
      n: name, s: slug_(name), t: type, f: faction, g: faction.split('/')[0].trim() || 'Neutral',
      k: /fusion/i.test(type) ? 0 : /creature/i.test(type) ? 1 : 2,
      a: get(r, 'ATK'), hp: get(r, 'HP'), fl: get(r, 'Flux Cost'), sp: get(r, 'Speed'), at: get(r, 'Attribute'),
      x: get(r, 'Description').replace(/\r\n/g, '\n'), d: briefs[name] || '', p: art[name] || null,
    });
  });
  return cards;
}

// ---- submissions from the response Sheet ----
function responseSheet_() {
  const sheets = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheets();
  return sheets.find(sh => sh.getLastRow() >= 1 && sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0]
    .some(h => /^which card/i.test(h.trim()))) || sheets[0];
}

/** Per card: the submission the board shows. Approved finished art wins, then an approved sketch, then an approved
 *  claim, then the newest one still in review. */
function getSubmissions_() {
  const range = responseSheet_().getDataRange();
  return pickSubmissions_(range.getDisplayValues(), range.getValues(), shareForBoard_, new Date(), fileIdOf_);
}

/** The Drive file in an "Upload your art!" cell: a Drive link (what the form writes), or the file's name for art
 *  added to the Sheet by hand ("FF_NuclearWaste", with or without its extension). */
function fileIdOf_(cell) {
  const first = (cell || '').split(',')[0].trim();
  if (!first) return null;
  const m = first.match(/[?&]id=([-\w]{25,})/) || first.match(/\/d\/([-\w]{25,})/);
  if (m) return m[1];
  if (/^https?:/i.test(first)) return null;
  return fileIdByName_(first);
}

function fileIdByName_(name) {
  const cache = CacheService.getScriptCache(), key = 'name:' + name;
  const hit = cache.get(key);
  if (hit) return hit === '-' ? null : hit;
  let best = null;
  try {
    const q = 'title contains "' + name.replace(/["\\]/g, '\\$&') + '" and trashed = false and mimeType contains "image/"';
    const files = DriveApp.searchFiles(q);
    while (files.hasNext()) {
      const f = files.next(), full = f.getName();
      if (full !== name && full.replace(/\.[^.]+$/, '') !== name) continue;   // the whole name, not just part of it
      if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f;     // the newest if there are copies
    }
  } catch (e) {}
  const id = best ? best.getId() : null;
  cache.put(key, id || '-', id ? 21600 : 300);   // a name that isn't found yet is tried again in 5 minutes
  return id;
}

/** What a row is: "final" art, a "sketch", or a "claim" with no art yet. Reads the "What are you sending?" question,
 *  or the older "Is this the finished art?" one. */
function kindOf_(answer) {
  const a = (answer || '').trim();
  if (/claim/i.test(a)) return 'claim';
  if (/^(yes|finished|final)/i.test(a)) return 'final';
  return 'sketch';
}

function pickSubmissions_(values, raw, share, now, resolve) {
  if (values.length < 2) return {};
  const head = values[0].map(h => h.trim().toLowerCase()), find = re => head.findIndex(h => re.test(h));
  const c = { time: find(/^timestamp/), card: find(/^which card/), file: find(/^upload your art/),
    kind: find(/^what are you sending|finished art/), credit: find(/^name to credit/), link: find(/where can people find/),
    ok: find(/^approved/) };
  const byCard = {};
  for (let i = values.length - 1; i >= 1; i--) {   // the newest row first
    const r = values[i], card = (r[c.card] || '').trim();
    if (!card) continue;
    const ok = c.ok >= 0 ? (r[c.ok] || '').trim().toLowerCase() : '';
    if (/^(no|n|rejected|reject)$/.test(ok)) continue;
    const kind = kindOf_(c.kind >= 0 ? r[c.kind] : '');
    const when = raw && raw[i] && c.time >= 0 && raw[i][c.time] instanceof Date ? raw[i][c.time] : null;
    if (kind === 'claim' && CONFIG.CLAIM_DAYS > 0 && when && now - when > CONFIG.CLAIM_DAYS * 864e5) continue;   // an old claim lapses
    const file = kind === 'claim' || c.file < 0 ? '' : r[c.file] || '';
    const link = c.link >= 0 ? (r[c.link] || '').trim() : '';
    (byCard[card] = byCard[card] || []).push({
      approved: ok === 'yes' || ok === 'y', kind, file,
      credit: c.credit >= 0 ? (r[c.credit] || '').trim().slice(0, 80) : '', link: /^https?:\/\/\S+$/i.test(link) ? link : '',
      date: c.time >= 0 ? (r[c.time] || '').split(' ')[0] : '',
    });
  }
  const out = {};
  Object.keys(byCard).forEach(card => {
    const list = byCard[card], ok = k => list.find(e => e.approved && e.kind === k);
    const pick = ok('final') || ok('sketch') || ok('claim') || list[0];
    const status = pick.approved ? (pick.kind === 'final' ? 'done' : 'progress') : 'review';
    let img = null;
    const id = pick.approved && pick.file ? resolve(pick.file) : null;   // only approved art is looked up and shared
    if (id && share(id)) img = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200';
    out[card] = { status, kind: pick.kind, credit: pick.approved ? pick.credit : '', link: pick.approved ? pick.link : '', img, date: pick.date };
  });
  return out;
}

/** Lets approved art show on the board: anyone with the link may view that one file. Nothing else is shared. */
function shareForBoard_(id) {
  const cache = CacheService.getScriptCache(), key = 'shared:' + id;
  if (cache.get(key)) return true;
  try {
    const file = DriveApp.getFileById(id);
    if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    cache.put(key, '1', 21600);
    return true;
  } catch (e) { return false; }
}
