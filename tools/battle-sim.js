/* Fusion Fuckery battle simulator (Rulebook v4.3, gameplay v2).
   Plays whole games between two decks with a rule-of-thumb AI, so the editor's Battle sim tab can play thousands
   of them and show which cards and combinations win too often. No DOM in here: tools/build.ps1 inlines this file
   into the editor, which runs it on the page (to watch one game) and in Web Workers (for big runs).
   Card effects are written per card name in FX (creatures, fusions) and SPELLS. A card without an entry plays with
   its stats only and the editor lists it. FX_TEXT remembers the card text each effect was written for, so the
   editor can say when a card's text has changed since. */
var BattleSim = (function () {
"use strict";

const R = { php: 40, hand: 5, fluxStart: 3, fluxMax: 10, secondFlux: 1, lanes: 3, fuseMin: 5, fuseFlux: 2,
  handLimit: 8, zones: 3, emptyDeck: 5, turnLimit: 40,   // turnLimit: turns per player before the game is a draw
  early: 12,   // the stats look at which cards were in the top 12 of the shuffled deck (opening hand + about 7 draws)
  redraw: true,   // v4.3: a player whose opening hand has 0 or 1 creatures shuffles it back and draws a new one, once
  sick: true,   // v4.3: creatures and fusions can't attack the turn they arrive (taking control of one isn't arriving)
  // Rules to try, aimed at giving players more decisions that matter (ideas from Magic, Lorcana, Pokemon and Yu-Gi-Oh!):
  winded: false,      // a creature that attacked can't hit back until its controller's next turn (Magic's tapping, Lorcana's exert)
  intercept: false,   // a creature next to a direct attacker may step in front of it and fight it instead (Magic's blocking)
  overclock: false,   // once per turn: put a card from your hand under your Reactor for +1 flux this turn (Lorcana's inkwell)
  bloodDraw: false,   // once per turn: pay 3 PHP to draw a card (a consistency engine, like Pokemon's draw Supporters)
  // Reactor flux, a structural change (Lorcana's inkwell): no automatic +1 a turn. Once per turn you may put a card from your
  // hand face down under your Reactor; your max flux is inkBase + the cards under it (up to fluxMax), and the new flux is usable at once.
  ink: false, inkBase: 2,
  // Reactor choice, a structural change: in your Reactor Phase (not your first turn) choose one: Charge (+1 max flux, as now),
  // Vent (draw a card instead) or Overload (+2 flux this turn only, lose overloadPHP PHP).
  reactor: false, overloadPHP: 2 };
const RULEBOOK = Object.assign({}, R);
// Try other rules for one run (the Battle sim tab's rule boxes): { php, hand, redraw, ... }; anything left out is the rulebook's.
function withRules(rules, fn) {
  Object.assign(R, RULEBOOK, rules || {});
  try { return fn(); } finally { Object.assign(R, RULEBOOK); }
}

/* ---------------- helpers ---------------- */
function rngFrom(seed) {   // mulberry32: same seed, same game
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shuffle(rng, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
// A sloppy player misjudges every choice by a random amount (sigma, in the AI's value points); 0 = the normal AI.
const jitter = (g, p) => g.sigma[p.i] ? g.sigma[p.i] * gauss(g.noise) : 0;
const lc = s => String(s || "").toLowerCase();
const isUnitKind = k => k === "creature" || k === "fusion";
const NB = [[1], [0, 2], [1]];   // the lanes next to each lane
const LANE = ["left", "middle", "right"];
const units = p => p.lanes.filter(Boolean);
const foe = (g, p) => g.p[1 - p.i];
const allUnits = g => units(g.p[0]).concat(units(g.p[1]));
const onField = (g, u) => !!u && g.p[u.ctrl].lanes[u.lane] === u;
const fxOf = u => u.negated ? null : u.d.fx;
const emptyLanes = p => [0, 1, 2].filter(l => !p.lanes[l]);
const hasAttr = (d, a) => d.attrs.includes(a);
const spellsOf = p => p.field ? p.zones.concat([p.field]) : p.zones;
const freeZone = p => p.zones.length < R.zones;
const canPay = (p, n) => p.php > n;   // the AI never pays itself to 0
const L = (g, s) => { if (g.log) g.log.push(s); };
const who = (g, p) => g.names[p.i];
function textHash(s) {
  s = lc(s).replace(/\s+/g, " ").trim(); let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
// Numbers some effects read straight from the card text, so tweaking those numbers on the card also tweaks the sim.
const num = (d, re, dflt) => { const m = String(d.text || "").match(re); return m ? +m[1] : dflt; };
const says = (d, re) => re.test(String(d.text || ""));
const goldCostOf = d => d.fx && d.fx.goldCost ? num(d, /pay (\d+) gold/i, d.fx.goldCost) : 0;
// average of a die, or of the higher of two dice ("roll twice and keep the higher result")
const dieAvg = (n, adv) => { if (!n) return 0; if (!adv) return (n + 1) / 2; let s = 0; for (let k = 1; k <= n; k++) s += k * (2 * k - 1); return s / (n * n); };

/* ---------------- stats the AI and the rules read ---------------- */
function advantage(g, u) {
  if (!u.die) return false;
  const f = fxOf(u); if (f && f.selfAdvantage) return true;
  if (!hasAttr(u.d, "greedy")) return false;
  return units(g.p[u.ctrl]).some(k => { const kf = fxOf(k); return kf && (kf.greedyAdvantage === "all" || (kf.greedyAdvantage === "others" && k !== u)); });
}
function atkOf(g, u) {   // ATK without the die
  let a = u.atk + u.pAtk + u.tAtk + u.radAtk;
  const p = g.p[u.ctrl];
  for (const k of units(p)) { const f = fxOf(k); if (f && f.aura) a += f.aura(g, k, u); }
  for (const z of spellsOf(p)) { const f = z.c.d.fx; if (f && f.aura) a += f.aura(g, p, u); }
  return Math.max(0, a);
}
const expAtk = (g, u) => atkOf(g, u) + dieAvg(u.die, advantage(g, u));
const speedOf = u => u.spd + u.tSpd;
function valueOf(g, u) { const f = fxOf(u); return expAtk(g, u) + Math.max(0, u.hp) / 2 + (speedOf(u) - 2) + (f && f.value || 0); }
const defValue = d => d.atk + dieAvg(d.die) + d.hp / 2 + (d.spd - 2) + (d.fx && d.fx.value || 0);
// how much the AI cares about 1 PHP / 1 gold right now
function phpW(g, p) {   // the same curve the attacker uses for damage to the other player (scoreFace)
  const threat = units(foe(g, p)).reduce((s, u) => s + expAtk(g, u), 0);
  return (0.45 + 6 / Math.max(1, p.php)) * (p.php - threat <= 6 ? 1.5 : 1);
}
function goldW(g, p) {
  const sink = units(p).some(u => { const f = fxOf(u); return f && f.goldSink; }) || p.hand.some(c => c.d.fx && c.d.fx.goldSink);
  return sink ? 0.7 : 0.25;
}
function goldReserve(g, p, except) {   // gold the AI keeps for Bull Run / Goblin King / a gold card in hand
  let r = spellsOf(p).some(z => z.c.d.fx && z.c.d.fx.wantsGold5) || units(p).some(u => fxOf(u) && fxOf(u).wantsGold5) ? 5 : 0;
  for (const c of p.hand) if (c !== except) r = Math.max(r, goldCostOf(c.d));
  return r;
}
// what losing u costs its controller (a Blood Frenzy creature is sacrificed at the end of the turn anyway, once it has attacked)
const keepWorth = (g, u) => u.stolen ? -valueOf(g, u) * 0.6 : u.frenzy ? (u.attacked ? 0 : 4) : valueOf(g, u);
function killWorth(g, p, u) {   // what destroying u is worth to p
  if (u.ctrl === p.i) return -keepWorth(g, u);
  let v = valueOf(g, u) + 1;
  const f = fxOf(u);
  if (f && f.survive && !u.chapel) v *= 0.25;
  if (f && f.returns && !u.c.lazarusUsed) v *= 0.5;
  if (f && f.deathPenalty) v -= f.deathPenalty;
  return v;
}
function damageWorth(g, p, u, n) {   // non-combat damage
  if (n <= 0) return 0;
  if (n >= u.hp) return killWorth(g, p, u);
  const v = (n / Math.max(1, u.maxHp)) * valueOf(g, u) * 0.5;
  return u.ctrl === p.i && !u.stolen ? -v : v;
}
const radiant = u => u.d.radiance && !u.negated;
const wantsAtk = (g, u) => g.active === u.ctrl && g.phase <= 2 && !u.attacked;   // Radiance: +ATK before it attacks, else +HP
function healWorth(g, u, n) {
  const missing = Math.max(0, u.maxHp - u.hp), healed = Math.min(n, missing), extra = n - healed;
  let s = healed * 0.45 * (u.hp <= u.maxHp / 3 ? 1.5 : 1);
  if (extra > 0 && radiant(u)) s += extra * (wantsAtk(g, u) ? 0.8 : 0.3);
  return s;
}
function bestHeal(g, p, n, exclude) {   // n: a number or u => number
  let best = null;
  for (const u of units(p)) {
    if (u === exclude || u.stolen) continue;
    const amt = typeof n === "function" ? n(u) : n, s = healWorth(g, u, amt);
    if (!best || s > best.s) best = { u, s, n: amt };
  }
  return best;
}
function sacrificeBonus(g, p) { let s = 0; for (const k of units(p)) { const f = fxOf(k); if (f && f.sacValue) s += f.sacValue(g, k); } return s; }
function wasteSpare(p) {   // Waste Repository cards the AI is happiest to banish, first
  const rank = c => isUnitKind(c.d.kind) ? (hasAttr(c.d, "unholy") ? (c.d.hp <= 5 ? 3 : 2) : 1) : 0;
  return p.waste.filter(c => !p.lazarus.includes(c)).sort((a, b) => rank(a) - rank(b));
}
const wasteUnholy = p => wasteSpare(p).filter(c => isUnitKind(c.d.kind) && hasAttr(c.d, "unholy"));
function keepValue(g, p, c) {   // for discarding and Goblin Shuffle
  const d = c.d;
  if (d.kind === "creature") return (d.flux || 0) - (d.bp || 0) > p.maxFlux + 1 ? 1 : 3 + defValue(d) * 0.1;
  return 3.5;
}

/* ---------------- the rules ---------------- */
function checkEnd(g) {
  if (g.over) return true;
  const a = g.p[0].php <= 0, b = g.p[1].php <= 0;
  if (a || b) { g.over = true; g.winner = a && b ? -1 : a ? 1 : 0; g.endReason = g.lastLoss || "php"; }
  return g.over;
}
function draw(g, p, n) {
  for (let k = 0; k < n && !g.over; k++) {
    if (!p.deck.length) { L(g, `${who(g, p)} has no cards left to draw and loses ${R.emptyDeck} PHP.`); losePHP(g, p, R.emptyDeck, { deck: true }); continue; }
    const c = p.deck.pop(); p.hand.push(c); if (c.owner === p.i) p.st.drawn.add(c.d.ix);
  }
}
function losePHP(g, p, n, info) {
  if (n <= 0 || g.over) return;
  info = info || {};
  p.php -= n; g.lastLoss = info.deck ? "deck" : "php";
  if (checkEnd(g)) return;
  for (const u of units(p)) { const f = fxOf(u); if (f && f.onLosePHP) f.onLosePHP(g, u, n, info); }
}
const payPHP = (g, p, n) => losePHP(g, p, n, { paid: true });
function gainPHP(g, p, n) { p.php += n; }
function restorePHP(g, p, n) { if (p.php < R.php) p.php = Math.min(R.php, p.php + n); }
function gainGold(g, p, n) {
  if (n <= 0) return;
  for (const z of spellsOf(p)) { const f = z.c.d.fx; if (f && f.goldBonus && p.bullTurn !== g.turnNo) { p.bullTurn = g.turnNo; n += 1; } }
  p.gold += n;
  L(g, `  ${who(g, p)} gains ${n} gold (${p.gold}).`);
  for (const u of units(p)) { const f = fxOf(u); if (f && f.onGainGold) f.onGainGold(g, u, n); }
}
function restoreHP(g, by, u, n) {
  if (n <= 0 || !onField(g, u)) return;
  const missing = Math.max(0, u.maxHp - u.hp), healed = Math.min(n, missing), extra = n - healed;
  u.hp += healed;
  let bonus = "";
  if (extra > 0 && radiant(u)) {
    if (wantsAtk(g, u)) { u.radAtk += extra; bonus = ` (Radiance: +${extra} ATK)`; } else { u.hp += extra; u.radHp += extra; bonus = ` (Radiance: +${extra} HP)`; }
  }
  if (!healed && !bonus) return;
  L(g, `  ${u.d.name} is restored ${n} HP${bonus}.`);
  for (const k of units(by)) { const f = fxOf(k); if (f && f.onYouRestore) f.onYouRestore(g, k); }
}
function damage(g, u, n, info) {
  if (n <= 0 || !onField(g, u)) return 0;
  u.hp -= n; u.radHp = Math.max(0, u.radHp - n);
  if (!info || !info.combat) L(g, `  ${u.d.name} takes ${n} damage.`);
  if (u.hp <= 0) kill(g, u, info || {});
  return n;
}
function kill(g, u, info) {   // "destroyed": Chapel Guard survives the first time
  const f = fxOf(u);
  if (f && f.survive && !u.chapel) { u.chapel = true; u.hp = 1; L(g, `  ${u.d.name} survives with 1 HP.`); return false; }
  destroy(g, u, info);
  return true;
}
const toWaste = (g, c) => g.p[c.owner].waste.push(c);
function destroy(g, u, info) {
  const p = g.p[u.ctrl];
  if (p.lanes[u.lane] !== u) return;
  p.lanes[u.lane] = null;
  const f = fxOf(u);
  toWaste(g, u.c); u.splices.forEach(c => toWaste(g, c));
  g.deaths++;
  L(g, `  ${u.d.name} is destroyed${info.sacrifice ? " (sacrificed)" : ""}.`);
  if (f && f.returns && !u.c.lazarusUsed) { u.c.lazarusUsed = true; g.p[u.c.owner].lazarus.push(u.c); }
  if (info.src && info.combat) { const kf = fxOf(info.src); if (kf && kf.onKill && onField(g, info.src)) kf.onKill(g, info.src, u); }
  if (f && f.onDeath) f.onDeath(g, u, info);
  for (const k of allUnits(g)) { const kf = fxOf(k); if (kf && kf.onAnyDeath) kf.onAnyDeath(g, k, u); }
}
function banishUnit(g, u) {
  const p = g.p[u.ctrl];
  if (p.lanes[u.lane] !== u) return;
  p.lanes[u.lane] = null;
  g.p[u.c.owner].oblivion.push(u.c); u.splices.forEach(c => toWaste(g, c));
  L(g, `  ${u.d.name} is banished.`);
}
function banishFromWaste(g, p, list) { for (const c of list) { const i = p.waste.indexOf(c); if (i >= 0) { p.waste.splice(i, 1); p.oblivion.push(c); } } }
function sacrifice(g, p, u) {
  if (!onField(g, u)) return;
  L(g, `${who(g, p)} sacrifices ${u.d.name}.`);
  destroy(g, u, { sacrifice: true });
  for (const k of units(p)) { const f = fxOf(k); if (f && f.onSacrifice) f.onSacrifice(g, k, u); }
}
function makeUnit(g, p, c, lane, halved) {
  const d = c.d, h = x => halved ? Math.floor(x / 2) : x, hp = Math.max(1, h(d.hp));
  return { c, d, uid: g.uid++, owner: c.owner, ctrl: p.i, lane, atk: h(d.atk), die: halved ? Math.floor(d.die / 2) : d.die,
    maxHp: hp, hp, spd: Math.max(1, h(d.spd)), pAtk: 0, tAtk: 0, tSpd: 0, radAtk: 0, radHp: 0,
    attacked: false, negated: false, chapel: false, splices: [], stolen: null, frenzy: false, minerFlux: false, arrived: g.turnNo };
}
function materialize(g, p, c, lane, how) {
  if (lane == null || p.lanes[lane]) return null;
  const u = makeUnit(g, p, c, lane, how === "lazarus");
  p.lanes[lane] = u;
  if (c.owner === p.i && how !== "lazarus") p.st.played.add(c.d.ix);
  if (!p.st.firstCre) p.st.firstCre = p.turns;
  L(g, `${who(g, p)} ${how === "hand" ? "plays" : how === "lazarus" ? "brings back" : "materializes"} ${c.d.name} (${LANE[lane]} lane)${how === "lazarus" ? " at half stats" : ""}.`);
  const f = fxOf(u); if (f && f.onPlay) f.onPlay(g, u);
  return u;
}
function cast(g, p, c, effect) {   // a one-shot Spell or Instant: it uses a spell zone while it resolves
  const i = p.hand.indexOf(c); if (i < 0) return;
  p.hand.splice(i, 1);
  if (c.owner === p.i) p.st.played.add(c.d.ix);
  L(g, `${who(g, p)} casts ${c.d.name}.`);
  effect();
  toWaste(g, c);
}
function putInPlay(g, p, c) {   // Continuous or Field Spell
  const i = p.hand.indexOf(c); if (i < 0) return;
  p.hand.splice(i, 1);
  if (c.owner === p.i) p.st.played.add(c.d.ix);
  L(g, `${who(g, p)} puts ${c.d.name} into play.`);
  if (c.d.kind === "field") { if (p.field) toWaste(g, p.field.c); p.field = { c }; } else p.zones.push({ c });
}
function removeSpell(g, q, z, why) {
  if (q.field === z) q.field = null; else { const i = q.zones.indexOf(z); if (i < 0) return; q.zones.splice(i, 1); }
  toWaste(g, z.c);
  L(g, `  ${z.c.d.name} is destroyed${why ? " by " + why : ""}.`);
}
function fitsPart(d, part) {
  if (part.kind === "card") return d.name === part.value;
  if (part.kind === "attr") return d.attrs.includes(part.value);
  if (part.kind === "faction") return d.factions.some(f => lc(f) === part.value);
  return false;
}
function recipeFits(rec, defs) {
  if (!rec || !rec.parts.length || rec.parts.some(x => x.kind === "unknown")) return false;
  if (rec.distinct && new Set(defs.map(d => d.name)).size < defs.length) return false;
  const slots = []; rec.parts.forEach(x => { for (let k = 0; k < x.count; k++) slots.push(x); });
  if (slots.length !== defs.length) return false;
  slots.sort((x, y) => (x.kind === "card" ? 0 : 1) - (y.kind === "card" ? 0 : 1));
  const used = defs.map(() => false);
  const go = i => {
    if (i === slots.length) return true;
    for (let j = 0; j < defs.length; j++) if (!used[j] && fitsPart(defs[j], slots[i])) { used[j] = true; if (go(i + 1)) return true; used[j] = false; }
    return false;
  };
  return go(0);
}
const pitOk = d => d.kind === "creature" && hasAttr(d, "unholy") && d.flux >= 3 && d.flux <= 4;
function fuse(g, p, a, b, fc, pay) {
  if (!onField(g, a) || !onField(g, b) || p.fused || p.fdeck.indexOf(fc) < 0) return;
  if (pay.kind === "flux") p.flux -= R.fuseFlux;
  else if (pay.kind === "estate") { const i = p.hand.indexOf(pay.card); if (i < 0) return; p.hand.splice(i, 1); if (pay.card.owner === p.i) p.st.played.add(pay.card.d.ix); L(g, `${who(g, p)} casts ${pay.card.d.name}.`); toWaste(g, pay.card); }
  else if (pay.kind === "altar") { sacrifice(g, p, pay.victim); if (g.over || !onField(g, a) || !onField(g, b)) return; }
  if (pay.pit) { const c = wasteUnholy(p)[0]; if (c) banishFromWaste(g, p, [c]); p.once.add("Ritual Pit"); }
  const lane = a.lane === 1 || b.lane === 1 ? 1 : a.lane;
  p.lanes[a.lane] = null; p.lanes[b.lane] = null;
  p.fdeck.splice(p.fdeck.indexOf(fc), 1);
  const u = makeUnit(g, p, fc, lane, false);
  u.splices = [a.c, b.c];
  p.lanes[lane] = u; p.fused = true; p.st.fused.add(fc.d.ix);
  if (!p.st.firstFuse) p.st.firstFuse = g.turnNo;
  L(g, `${who(g, p)} fuses ${a.d.name} + ${b.d.name} into ${fc.d.name}${pay.kind === "estate" ? " for free (It's free fuse-estate)" : pay.kind === "altar" ? " (Crimson Altar instead of flux)" : ""}${pay.pit ? " (Ritual Pit)" : ""}.`);
  const f = fxOf(u); if (f && f.onPlay) f.onPlay(g, u);
}
function unfuse(g, by, u) {
  const p = g.p[u.ctrl];
  if (!onField(g, u)) return;
  p.lanes[u.lane] = null;
  g.p[u.c.owner].fdeck.push(u.c);
  L(g, `  ${u.d.name} breaks back into ${u.splices.map(c => c.d.name).join(" + ")}.`);
  u.splices.forEach((c, k) => {
    const q = g.p[c.owner], lane = k === 0 && q === p ? u.lane : emptyLanes(q)[0];
    if (lane === undefined) { toWaste(g, c); return; }
    q.lanes[lane] = makeUnit(g, q, c, lane, false);
  });
}
function steal(g, p, u) {   // Space Squid: until the end of this turn
  const o = g.p[u.ctrl], free = emptyLanes(p);
  if (!free.length || !onField(g, u)) return;
  const lane = free.includes(u.lane) ? u.lane : free[0];
  o.lanes[u.lane] = null;
  u.stolen = { home: u.lane }; u.ctrl = p.i; u.lane = lane; u.attacked = false;
  p.lanes[lane] = u;
  L(g, `  ${who(g, p)} takes control of ${u.d.name} for the turn.`);
}
function giveBack(g, u) {
  const p = g.p[u.ctrl], o = g.p[u.owner];
  p.lanes[u.lane] = null;
  const lane = !o.lanes[u.stolen.home] ? u.stolen.home : emptyLanes(o)[0];
  u.stolen = null;
  if (lane === undefined) { toWaste(g, u.c); u.splices.forEach(c => toWaste(g, c)); L(g, `  ${u.d.name} has no lane to go back to and goes to the Waste Repository.`); return; }
  u.ctrl = o.i; u.lane = lane; o.lanes[lane] = u;
}

/* ---------------- combat ---------------- */
function guardOf(g, u) {   // Sanctified Knight: 1 less combat damage for creatures next to it
  let n = 0; const p = g.p[u.ctrl];
  for (const l of NB[u.lane]) { const k = p.lanes[l], f = k && fxOf(k); if (f && f.guardNeighbors) n += f.guardNeighbors; }
  return n;
}
function useLoadedDice(g, q) {
  const c = q.hand.find(x => x.d.fx && x.d.fx.loaded);
  if (!c || !freeZone(q)) return false;
  cast(g, q, c, () => {});
  return true;
}
function pitBossReroll(g, q) {   // an activated effect, so only on its controller's own turn
  if (g.active !== q.i || q.gold < 1 || q.once.has("Goblin Pit Boss:reroll")) return false;
  if (!units(q).some(k => { const f = fxOf(k); return f && f.rerolls; })) return false;
  q.once.add("Goblin Pit Boss:reroll"); q.gold -= 1;
  L(g, `  ${who(g, q)} pays 1 gold to reroll (Goblin Pit Boss).`);
  return true;
}
function rollDie(g, u, noReroll) {
  const p = g.p[u.ctrl], o = foe(g, p), adv = advantage(g, u), greedy = hasAttr(u.d, "greedy");
  const once = () => { let r = 1 + Math.floor(g.dice() * u.die); if (adv) r = Math.max(r, 1 + Math.floor(g.dice() * u.die)); return r; };
  let r = once();
  const f = fxOf(u);
  if (noReroll) { /* the hit is prevented anyway */ }
  else if ((u.die >= 6 && r <= u.die * 0.34) || (f && f.orc && r === 1)) {
    if ((greedy && pitBossReroll(g, p)) || useLoadedDice(g, p)) { const was = r; r = once(); L(g, `  ${u.d.name} rerolls its ${was}: ${r}.`); }
  } else if (u.die >= 8 && r >= u.die * 0.8) {
    if ((greedy && pitBossReroll(g, o)) || useLoadedDice(g, o)) { const was = r; r = once(); L(g, `  ${u.d.name}'s ${was} is rerolled: ${r}.`); }
  }
  if (r === u.die && greedy) for (const k of units(p)) { const kf = fxOf(k); if (kf && kf.onMaxRoll) kf.onMaxRoll(g, k, u); }
  return r;
}
function hitUnit(g, src, tgt, n, ctx, rolled) {
  n = ctx.shelter === tgt ? 0 : Math.max(0, n - guardOf(g, tgt));
  L(g, `  ${src.d.name} hits ${tgt.d.name} for ${n}${rolled ? ` (rolled ${rolled})` : ""}${ctx.shelter === tgt ? " (Divine Shelter)" : ""}.`);
  if (n <= 0) return 0;
  const dealt = damage(g, tgt, n, { src, combat: true });
  const f = fxOf(src); if (f && f.onCombatDamage) f.onCombatDamage(g, src, dealt);
  return dealt;
}
function strike(g, src, tgt, ctx) {
  if (g.over || !onField(g, src) || !onField(g, tgt)) return 0;
  let n = atkOf(g, src), nat = 0;
  if (src.die) { nat = rollDie(g, src, ctx.shelter === tgt); n += nat; }
  const f = fxOf(src), orc = f && f.orc && ctx.attack && src.die === 20;
  if (orc && nat === 1) n = Math.floor(n / 2);
  const side = g.p[tgt.ctrl], lane = tgt.lane;
  const dealt = hitUnit(g, src, tgt, n, ctx, nat);
  if (orc && nat === 20) for (const l of NB[lane]) { const t2 = side.lanes[l]; if (t2) hitUnit(g, src, t2, n, ctx, 0); }
  return dealt;
}
function expHit(g, src, tgt) { return Math.max(0, expAtk(g, src) - guardOf(g, tgt)); }
function survives(u, hp) { const f = fxOf(u); return hp > 0 || !!(f && f.survive && !u.chapel); }
const canHitBack = u => !(R.winded && u.winded);
// Winded: after attacking, u can't hit back on the other player's next turn, so the creatures that can reach it hit it for free
function exposure(g, u, hpAfter) {
  if (!R.winded || hpAfter <= 0) return 0;
  const o = foe(g, g.p[u.ctrl]); let dmg = 0;
  for (const e of units(o)) if (Math.abs(e.lane - u.lane) <= 1) dmg += expHit(g, e, u);
  const ka = keepWorth(g, u);
  return dmg >= hpAfter ? ka * 0.5 : (dmg / Math.max(1, u.maxHp)) * ka * 0.25;
}
function previewFight(g, att, def) {   // expected outcome, dice at their average
  let aHp = att.hp, dHp = def.hp;
  const back = canHitBack(def);
  if (!back) dHp -= expHit(g, att, def);
  else if (speedOf(att) + 1 >= speedOf(def)) { dHp -= expHit(g, att, def); if (survives(def, dHp)) aHp -= expHit(g, def, att); }
  else { aHp -= expHit(g, def, att); if (survives(att, aHp)) dHp -= expHit(g, att, def); }
  if (aHp <= 0 && survives(att, aHp)) aHp = 1;
  if (dHp <= 0 && survives(def, dHp)) dHp = 1;
  return { aDies: aHp <= 0, dDies: dHp <= 0, aLoss: att.hp - Math.max(0, aHp), dLoss: def.hp - Math.max(0, dHp) };
}
function scoreFight(g, att, def) {
  const p = g.p[att.ctrl], r = previewFight(g, att, def), ka = keepWorth(g, att);
  let s = r.dDies ? killWorth(g, p, def) + 0.5 : (r.dLoss / Math.max(1, def.maxHp)) * valueOf(g, def) * 0.6;
  s -= r.aDies ? ka : (r.aLoss / Math.max(1, att.maxHp)) * ka * 0.5;
  if (!r.aDies) s -= exposure(g, att, att.hp - r.aLoss);
  return s;
}
// Intercept: the defender's best creature to step in front of a direct attack, or null when letting it through is better
function interceptChoice(g, att, noisy) {
  if (!R.intercept) return null;
  const o = foe(g, g.p[att.ctrl]), face = expAtk(g, att);
  let backDmg = 0; for (const l of NB[att.lane]) { const e = o.lanes[l]; if (e && canHitBack(e)) backDmg += expHit(g, e, att); }
  const hurt = backDmg >= att.hp ? killWorth(g, o, att) : (backDmg / Math.max(1, att.maxHp)) * valueOf(g, att) * 0.6;
  const through = hurt - face * phpW(g, o) * (face >= o.php ? 100 : 1);
  let best = null;
  for (const l of NB[att.lane]) {
    const e = o.lanes[l]; if (!e || !canHitBack(e)) continue;
    const r = previewFight(g, att, e);
    let s = (r.aDies ? killWorth(g, o, att) : (r.aLoss / Math.max(1, att.maxHp)) * valueOf(g, att) * 0.6)
      - (r.dDies ? keepWorth(g, e) : (r.dLoss / Math.max(1, e.maxHp)) * keepWorth(g, e) * 0.5);
    if (noisy) s += jitter(g, o);
    if (!best || s > best.s) best = { e, s };
  }
  return best && best.s > through ? best.e : null;
}
function scoreFace(g, att) {
  const p = g.p[att.ctrl], o = foe(g, p), aS = speedOf(att) + 1;
  const blocker = interceptChoice(g, att, false);
  if (blocker) return scoreFight(g, att, blocker);   // expect the block
  const backs = NB[att.lane].map(l => o.lanes[l]).filter(e => e && canHitBack(e));
  let hp = att.hp, face = 0;
  for (const e of backs) if (speedOf(e) > aS) hp -= expHit(g, e, att);
  if (survives(att, hp)) {
    face = expAtk(g, att); if (hp <= 0) hp = 1;
    for (const e of backs) if (speedOf(e) <= aS) hp -= expHit(g, e, att);
  }
  const ka = keepWorth(g, att), dies = !survives(att, hp);
  const w = face >= o.php ? 100 : 0.55 + 6 / Math.max(1, o.php - face);
  return face * w - (dies ? ka : ((att.hp - Math.max(0, hp)) / Math.max(1, att.maxHp)) * ka * 0.5) - (dies ? 0 : exposure(g, att, hp));
}
function bestAttack(g, u) {   // AI: the best score u can get from one attack this turn
  const o = foe(g, g.p[u.ctrl]); let best = -Infinity;
  if (R.sick && u.arrived === g.turnNo) return best;   // it can't attack yet
  for (const l of [u.lane].concat(NB[u.lane])) if (o.lanes[l]) best = Math.max(best, scoreFight(g, u, o.lanes[l]));
  if (!o.lanes[u.lane]) best = Math.max(best, scoreFace(g, u));
  return best;
}
function shelterResponse(g, o, att, def, ctx) {
  const c = o.hand.find(x => x.d.fx && x.d.fx.shelter);
  if (!c || !freeZone(o)) return;
  const r = previewFight(g, att, def), v = valueOf(g, def);
  if ((r.dDies && v >= 5) || (r.dLoss >= def.hp * 0.6 && v >= 9)) cast(g, o, c, () => { ctx.shelter = def; });
}
function fight(g, att, def, intercepted) {
  const o = g.p[def.ctrl];
  att.attacked = true; if (R.winded) att.winded = true;
  if (!intercepted) {
    L(g, `${att.d.name} attacks ${def.d.name}.`);
    const f = fxOf(att); if (f && f.onAttack) f.onAttack(g, att, def);
    if (g.over || !onField(g, att) || !onField(g, def)) return;
  }
  const ctx = { shelter: null };
  shelterResponse(g, o, att, def, ctx);
  const back = canHitBack(def);
  if (!back) L(g, `  ${def.d.name} is winded and can't hit back.`);
  const attFirst = !back || speedOf(att) + 1 >= speedOf(def), a = attFirst ? att : def, b = attFirst ? def : att;
  strike(g, a, b, { shelter: ctx.shelter, attack: a === att });
  if (onField(g, a) && onField(g, b) && (b === att || back)) strike(g, b, a, { shelter: ctx.shelter, attack: b === att });
}
function directAttack(g, att) {
  const p = g.p[att.ctrl], o = foe(g, p), aS = speedOf(att) + 1;
  att.attacked = true; if (R.winded) att.winded = true;
  L(g, `${att.d.name} attacks ${who(g, o)} directly.`);
  const f = fxOf(att); if (f && f.onAttack) f.onAttack(g, att, null);
  if (g.over || !onField(g, att)) return;
  const blocker = interceptChoice(g, att, true);
  if (blocker) { L(g, `  ${blocker.d.name} steps in front of it.`); return fight(g, att, blocker, true); }
  const backs = NB[att.lane].map(l => o.lanes[l]).filter(e => e && canHitBack(e));
  for (const e of backs) if (speedOf(e) > aS) strike(g, e, att, {});
  if (onField(g, att) && !g.over) {
    let n = atkOf(g, att), nat = 0;
    if (att.die) { nat = rollDie(g, att); n += nat; }
    const af = fxOf(att); if (af && af.orc && nat === 1) n = Math.floor(n / 2);
    L(g, `  ${att.d.name} hits ${who(g, o)} for ${n}${nat ? ` (rolled ${nat})` : ""}.`);
    if (n > 0) {
      p.st.face += n;
      losePHP(g, o, n, { combat: true });
      if (af && af.onCombatDamage) af.onCombatDamage(g, att, n);
    }
  }
  for (const e of backs) if (speedOf(e) <= aS && onField(g, att) && onField(g, e)) strike(g, e, att, {});
}

/* ---------------- card effects ---------------- */
const destroyAct = (maxHp, php) => ({ id: "destroy", pri: 1, ai(g, u) {
  const p = g.p[u.ctrl]; if (!canPay(p, php)) return null;
  let best = null;
  for (const t of units(foe(g, p))) if (t.hp <= maxHp) { const s = killWorth(g, p, t) - php * phpW(g, p); if (!best || s > best.s) best = { t, s }; }
  return best && best.s > 0.5 ? { score: best.s, run: () => { L(g, `${u.d.name} pays ${php} PHP to destroy ${best.t.d.name}.`); payPHP(g, p, php); if (!g.over && onField(g, best.t)) kill(g, best.t, {}); } } : null;
} });
const investAct = rate => ({ id: "invest", pri: 3, ai(g, u) {
  const p = g.p[u.ctrl]; if (u.stolen) return null;
  const n = p.gold - goldReserve(g, p); if (n <= 0) return null;
  return { score: n * rate * 0.6, run: () => {
    p.gold -= n; let atk = 0, hp = 0;
    for (let k = 0; k < n; k++) { if (u.hp + hp <= 3) hp += rate; else atk += rate; }
    u.pAtk += atk; u.maxHp += hp; u.hp += hp;
    L(g, `${who(g, p)} invests ${n} gold in ${u.d.name} (+${atk} ATK, +${hp} HP).`);
  } };
} });
const healAct = (n, self) => ({ id: "heal", pri: 3, ai(g, u) {
  const p = g.p[u.ctrl], t = bestHeal(g, p, n, self ? null : u);
  return t && t.s > 0.3 ? { score: t.s, run: () => restoreHP(g, p, t.u, n) } : null;
} });
function boomOption(g, u, alive) {   // Gob-omber: pay X gold, deal X to every creature
  const p = g.p[u.ctrl];
  if (alive && (g.active !== p.i || u.stolen)) return null;
  let best = null;
  for (let x = 1; x <= p.gold; x++) {
    let s = -x * goldW(g, p) * 0.5 - (alive ? keepWorth(g, u) : 0);
    for (const t of allUnits(g)) if (t !== u) s += damageWorth(g, p, t, x);
    if (!best || s > best.s) best = { x, s };
  }
  if (!best || best.s < 2) return null;
  return { score: best.s, run: () => {
    if (alive) { if (!onField(g, u)) return; banishUnit(g, u); }
    else { const q = g.p[u.c.owner], i = q.waste.indexOf(u.c); if (i < 0) return; q.waste.splice(i, 1); q.oblivion.push(u.c); }
    p.gold -= best.x;
    L(g, `${who(g, p)} pays ${best.x} gold: Gob-omber explodes for ${best.x} damage to every creature.`);
    for (const t of allUnits(g)) damage(g, t, best.x, {});
  } };
}
function angelZap(g, u) {   // Fallen Angel
  const p = g.p[u.ctrl], key = "Fallen Angel:zap";
  if (p.once.has(key) || !onField(g, u)) return;
  const t = foe(g, p).lanes[u.lane]; if (!t) return;
  p.once.add(key); L(g, `  Fallen Angel deals 2 damage to ${t.d.name}.`); damage(g, t, 2, {});
}
function chooseLane(g, p, d) {
  const free = emptyLanes(p); if (free.length <= 1) return free[0];
  let best = free[0], bs = -Infinity;
  for (const l of free) {
    let s = 0;
    if (d.flux >= R.fuseMin || pitOk(d)) for (const nl of NB[l]) {
      const nu = p.lanes[nl];
      if (nu && nu.d.kind === "creature" && p.fdeck.some(fc => recipeFits(fc.d.recipe, [d, nu.d]))) s += 4;
    }
    if (l === 1) s += (d.atk + dieAvg(d.die)) * 0.15;
    const e = foe(g, p).lanes[l];
    if (e) s += expAtk(g, e) * (p.php <= 15 ? 0.6 : 0.35) - (expAtk(g, e) >= d.hp ? 1.5 : 0);   // blocks its direct attacks
    else s += 0.5 + (d.atk + dieAvg(d.die)) * 0.1;   // free to hit the player
    s += jitter(g, p) * 0.5;
    if (s > bs) { bs = s; best = l; }
  }
  return best;
}

const FX = {
  "Cherub": { value: 1, onPlay(g, u) { const p = g.p[u.ctrl], t = bestHeal(g, p, 2, u); if (t && t.s > 0) restoreHP(g, p, t.u, 2); } },
  "Holy Acolyte": { value: 2, acts: [healAct(2, false)] },
  "Sanctified Knight": { value: 2, guardNeighbors: 1 },
  "Judicator Angel": { value: 2, onAttack(g, u) { const p = g.p[u.ctrl]; NB[u.lane].forEach(l => { if (p.lanes[l]) restoreHP(g, p, p.lanes[l], 2); }); } },
  "Chapel Guard": { value: 3, survive: true },
  "Purifier Nun": { value: 2, onPlay(g, u) {
    const p = g.p[u.ctrl], others = says(u.d, /restore \d+ HP to another creature/i); let best = null;
    for (const t of allUnits(g)) {
      if (others && t === u) continue;
      const s = hasAttr(t.d, "unholy") ? damageWorth(g, p, t, 3) : t.ctrl === p.i && !t.stolen ? healWorth(g, t, 3) : -1;
      if (!best || s > best.s) best = { t, s };
    }
    if (!best || best.s <= 0) return;
    if (hasAttr(best.t.d, "unholy")) { L(g, `  Purifier Nun deals 3 damage to ${best.t.d.name}.`); damage(g, best.t, 3, {}); } else restoreHP(g, p, best.t, 3);
  } },
  "Bellkeeper Monk": { value: 3, startTurn(g, u) {
    const p = g.p[u.ctrl], n = g.p.some(q => q.field && q.field.c.d.fx && q.field.c.d.fx.bells) ? 2 : 1;
    units(p).forEach(t => restoreHP(g, p, t, n));
  } },
  "Archangel": { value: 2, acts: [healAct(2, true)] },
  "Pain Drinker": { value: 1, onLosePHP(g, u) { u.tAtk += 1; } },
  "Carrion Duchess": { value: 3, endTurn(g, u) {
    const p = g.p[u.ctrl], cost = num(u.d, /pay (\d+) PHP to return/i, 2), maxHp = num(u.d, /with (\d+) or less max HP/i, 5);
    if (!emptyLanes(p).length || !canPay(p, cost)) return;
    let best = null;
    for (const c of p.waste) if (c.d.kind === "creature" && hasAttr(c.d, "unholy") && c.d.hp <= maxHp) { const v = defValue(c.d); if (!best || v > best.v) best = { c, v }; }
    if (!best || best.v - cost * phpW(g, p) <= 0.5) return;
    L(g, `${who(g, p)} pays ${cost} PHP (Carrion Duchess).`);
    payPHP(g, p, cost); if (g.over) return;
    p.waste.splice(p.waste.indexOf(best.c), 1);
    materialize(g, p, best.c, chooseLane(g, p, best.c.d), "effect");
  } },
  "Nomed The Dark Viscount": { value: 2, onCombatDamage(g, u) { gainPHP(g, g.p[u.ctrl], 1); } },
  "Renroc The Dark Marquis": { value: 4, acts: [destroyAct(4, 2)] },
  "Blood Priest": { value: 2, sacValue: (g, k) => 2 * phpW(g, g.p[k.ctrl]), onSacrifice(g, u) { gainPHP(g, g.p[u.ctrl], 2); } },
  "Blood Imp": { value: 1, deathPenalty: 1.5, onDeath(g, u) {
    const p = g.p[u.ctrl], o = foe(g, p), es = units(o);
    if (!es.length) { L(g, `  Blood Imp deals 2 damage to ${who(g, o)}.`); losePHP(g, o, 2, {}); return; }
    let best = null; for (const t of es) { const s = damageWorth(g, p, t, 2); if (!best || s > best.s) best = { t, s }; }
    L(g, `  Blood Imp deals 2 damage to ${best.t.d.name}.`); damage(g, best.t, 2, {});
  } },
  "Vein Ripper": {},
  "Flesh Collector": { value: 3, bpWaste: true, acts: [{ id: "eat", pri: 3, ai(g, u) {
    const p = g.p[u.ctrl]; let best = null;
    for (const t of units(p)) { if (t === u) continue; const s = 3.5 + sacrificeBonus(g, p) - keepWorth(g, t) + (fxOf(t) && fxOf(t).deathPenalty ? 1.5 : 0); if (!best || s > best.s) best = { t, s }; }
    return best && best.s > 0.5 ? { score: best.s, run: () => {
      sacrifice(g, p, best.t);
      if (!g.over && onField(g, u)) { draw(g, p, 1); u.pAtk += 2; u.maxHp += 2; u.hp += 2; }
    } } : null;
  } }] },
  "Hemogoblin": { value: 2, acts: [{ id: "gold", pri: 0, ai(g, u) {
    const p = g.p[u.ctrl]; if (!canPay(p, 2)) return null;
    const s = 2 * goldW(g, p) - 2 * phpW(g, p);
    return s > 0.3 ? { score: s, run: () => { L(g, `${who(g, p)} pays 2 PHP for 2 gold (Hemogoblin).`); payPHP(g, p, 2); if (!g.over) gainGold(g, p, 2); } } : null;
  } }] },
  "Goblin": { value: 1, goldSink: true, acts: [investAct(1)] },
  "Penny Stock Goblin": { value: 0.5, onGainGold(g, u) { u.tAtk += 1; }, acts: [{ id: "cash", pri: 0, ai(g, u) {
    const p = g.p[u.ctrl]; if (g.phase !== 1 || u.stolen || emptyLanes(p).length) return null;
    const crea = handCreatureOpts(g, p), more = bestSubset(g, p, crea, p.flux, 1, p.pact).score;
    const s = more - keepWorth(g, u) + goldW(g, p);
    return s > 1 ? { score: s, run: () => { banishUnit(g, u); gainGold(g, p, 1); } } : null;
  } }] },
  "Goblin General": { value: 3, greedyAdvantage: "others", acts: [{ id: "mend", pri: 3, ai(g, u) {
    const p = g.p[u.ctrl], x = Math.min(u.maxHp - u.hp, p.gold - goldReserve(g, p)); if (x <= 0) return null;
    const s = x * 0.45 - x * goldW(g, p) * 0.5;
    return s > 0.3 ? { score: s, run: () => { p.gold -= x; restoreHP(g, p, u, x); } } : null;
  } }] },
  "Gob-omber": { value: 3, goldSink: true, acts: [{ id: "boom", pri: 1, ai: (g, u) => boomOption(g, u, true) }],
    onDeath(g, u) { const o = boomOption(g, u, false); if (o) o.run(); } },
  "Goblin Miner": { value: 2, onPlay(g, u) { if (says(u.d, /when materialized/i)) gainGold(g, g.p[u.ctrl], 1); },
    startTurn(g, u) { const p = g.p[u.ctrl]; if (u.minerFlux) { u.minerFlux = false; p.flux += 1; L(g, `  Goblin Miner gives 1 flux.`); } else gainGold(g, p, 1); },
    acts: [{ id: "flux", pri: 4, ai(g, u) {
      const p = g.p[u.ctrl]; if (g.phase !== 3 || u.minerFlux || u.stolen || p.gold - 2 < goldReserve(g, p)) return null;
      const s = 1.2 - 2 * goldW(g, p);
      return s > 0.4 ? { score: s, run: () => { p.gold -= 2; u.minerFlux = true; } } : null;
    } }] },
  "Goblin Pit Boss": { value: 3, rerolls: true, onMaxRoll(g, k) { L(g, `  Goblin Pit Boss: highest roll, +2 gold.`); gainGold(g, g.p[k.ctrl], 2); } },
  "Orc": { value: 1, orc: true },
  "Seraphim Wall": {},
  "Fallen Angel": { value: 3, onYouRestore(g, u) { angelZap(g, u); }, onLosePHP(g, u, n, info) { if (info.paid) angelZap(g, u); } },
  "Lord Lazarus": { value: 4, returns: true },
  "Arch Cleric": { value: 3, startTurn(g, u) { const p = g.p[u.ctrl], t = bestHeal(g, p, 3); if (t && t.s > 0) restoreHP(g, p, t.u, 3); } },
  "Skinless Titan": { value: 2, endTurn(g, u) { L(g, `  Skinless Titan: ${who(g, g.p[u.ctrl])} loses 2 PHP.`); losePHP(g, g.p[u.ctrl], 2, {}); },
    onLosePHP(g, u) { u.tAtk += 1; },
    onKill(g, u) { L(g, `  Skinless Titan deals 2 damage to each enemy creature.`); units(foe(g, g.p[u.ctrl])).forEach(t => damage(g, t, 2, {})); } },
  "The Meat Cathedral": { value: 4, sacValue: () => 2, onSacrifice(g, u) { u.pAtk += 2; }, acts: [{ id: "feast", pri: 3, ai(g, u) {
    const p = g.p[u.ctrl], spare = wasteSpare(p); if (spare.length < 2) return null;
    const t = bestHeal(g, p, 5), hs = t ? t.s : 0, ps = 5 * phpW(g, p), s = Math.max(hs, ps) - 0.6;
    return s > 0.3 ? { score: s, run: () => { banishFromWaste(g, p, spare.slice(0, 2)); if (hs >= ps) restoreHP(g, p, t.u, 5); else { L(g, `  The Meat Cathedral: +5 PHP.`); gainPHP(g, p, 5); } } } : null;
  } }] },
  "Ergof The Dark Emperor": { value: 5, acts: [destroyAct(6, 3)] },
  "Hop Goblin": { value: 3, selfAdvantage: true, goldSink: true, acts: [investAct(2)] },
  "Soul Sucker": { value: 3,
    startTurn(g, u) { const n = g.deaths - g.p[u.ctrl].deathMark; if (n > 0) { u.pAtk += n; L(g, `  Soul Sucker gains +${n} ATK.`); } },
    onAnyDeath(g, u) { const p = g.p[u.ctrl]; if (goldW(g, p) > phpW(g, p)) gainGold(g, p, 1); else gainPHP(g, p, 1); } },
  "Seraph of Judgment": { value: 2, onAttack(g, u) { const p = g.p[u.ctrl], t = bestHeal(g, p, 2); if (t) restoreHP(g, p, t.u, 2); } },
  "Goblin King": { value: 4, greedyAdvantage: "all", wantsGold5: true, startTurn(g, u) { gainGold(g, g.p[u.ctrl], 1); },
    aura(g, k, u) { return hasAttr(u.d, "greedy") ? Math.floor(g.p[k.ctrl].gold / 5) : 0; } },
  "Goblin Bombardier": { value: 4, goldSink: true, acts: [{ id: "bomb", pri: 1, ai(g, u) {
    const p = g.p[u.ctrl], o = foe(g, p); let best = null;
    for (const t of units(o)) for (let x = 1; x <= p.gold; x++) {
      let s = damageWorth(g, p, t, x) - x * goldW(g, p) * 0.6;
      for (const l of NB[t.lane]) if (o.lanes[l]) s += damageWorth(g, p, o.lanes[l], Math.floor(x / 2));
      if (!best || s > best.s) best = { t, x, s };
    }
    return best && best.s > 1 ? { score: best.s, run: () => {
      const side = NB[best.t.lane].map(l => o.lanes[l]).filter(Boolean);
      p.gold -= best.x; L(g, `${who(g, p)} pays ${best.x} gold (Goblin Bombardier).`);
      damage(g, best.t, best.x, {}); side.forEach(t => damage(g, t, Math.floor(best.x / 2), {}));
    } } : null;
  } }] },
  "Indulgence Seller": { value: 3, goldSink: true, acts: [{ id: "sell", pri: 3, ai(g, u) {
    const p = g.p[u.ctrl], avail = p.gold - goldReserve(g, p); if (avail <= 0) return null;
    let best = null;
    for (const t of units(p)) {
      if (t.stolen) continue;
      const x = radiant(t) && wantsAtk(g, t) ? avail : Math.min(avail, Math.ceil(Math.max(0, t.maxHp - t.hp) / 2));
      if (!x) continue;
      const s = healWorth(g, t, 2 * x) - x * goldW(g, p) * 0.5;
      if (!best || s > best.s) best = { t, x, s };
    }
    return best && best.s > 0.3 ? { score: best.s, run: () => { p.gold -= best.x; restoreHP(g, p, best.t, 2 * best.x); } } : null;
  } }] },
};

// one-shot spells: play(g, p, card) returns { pri, score, run } or null. pri: 0 setup, 1 removal, 2 creatures (the plan), 3 after
const SPELLS = {
  "Ritual Pit": { perm: true, pit: true, needs: x => x.fusions > 0 && x.pitTargets > 0, score: (g, p) => p.fdeck.length ? 2.2 : 0.6 },
  "Bull Run": { perm: true, goldBonus: true, wantsGold5: true, score: () => 2.5,
    aura: (g, p, u) => hasAttr(u.d, "greedy") && p.gold >= num(spellsOf(p).find(z => z.c.d.fx && z.c.d.fx.goldBonus).c.d, /while you have (\d+) or more gold/i, 5) ? 1 : 0 },
  "Goblin Bank": { perm: true, startTurn(g, p) { if (p.gold < 5) gainGold(g, p, 1); }, score: () => 2.5 },
  "Sanctuary Bells": { perm: true, bells: true, score: () => 2.5,
    startTurn(g, p) { units(p).forEach(u => { if (hasAttr(u.d, "holy")) restoreHP(g, p, u, 1); }); },
    endEachTurn(g) { g.p.forEach(q => restorePHP(g, q, 1)); } },
  "Crimson Altar": { perm: true, altar: true, needs: x => x.fusions > 0 && x.unholy >= 4, score: (g, p) => p.fdeck.length ? 2 : 0.5,
    acts: [{ id: "feed", pri: 3, ai(g, p, z) {   // only if its text has "sacrifice ... to draw N cards"
      const n = num(z.c.d, /sacrifice[^.]*to draw (\d+) card/i, 0); if (!n) return null;
      let best = null;
      for (const u of units(p)) if (hasAttr(u.d, "unholy")) { const s = n * 2.2 + sacrificeBonus(g, p) - keepWorth(g, u) + (fxOf(u) && fxOf(u).deathPenalty ? 1.5 : 0); if (!best || s > best.s) best = { u, s }; }
      return best && best.s > 0.5 ? { score: best.s, run: () => { sacrifice(g, p, best.u); if (!g.over) draw(g, p, n); } } : null;
    } }] },
  "Divine Shelter": { shelter: true },
  "Loaded Dice": { loaded: true, needs: x => x.dice >= 4 },
  "It's free fuse-estate": { estate: true, needs: x => x.fusions > 0 },
  "Jar of Materialism": { play(g, p, c) {
    const cost = num(c.d, /pay (\d+) PHP/i, 0), n = num(c.d, /draw (\d+) cards/i, 2);
    if (p.deck.length < n || (cost && !canPay(p, cost))) return null;
    const s = 2.5 * n - cost * phpW(g, p);
    return s > 0.4 ? { pri: 0, score: s, run: () => cast(g, p, c, () => { if (cost) payPHP(g, p, cost); if (!g.over) draw(g, p, n); }) } : null;
  } },
  "Energy drink": { play(g, p, c) {
    const t = bestHeal(g, p, u => Math.floor(u.maxHp / 2));
    return t && t.s > 1.2 ? { pri: 3, score: t.s - 0.8, run: () => cast(g, p, c, () => restoreHP(g, p, t.u, t.n)) } : null;
  } },
  "Open Vein": { play(g, p, c) {
    if (!canPay(p, 3)) return null;
    let best = null;
    for (const t of units(foe(g, p))) { const s = damageWorth(g, p, t, t.hp < t.maxHp ? 5 : 3) - 3 * phpW(g, p) - 0.8; if (!best || s > best.s) best = { t, s }; }
    return best && best.s > 0.5 ? { pri: 1, score: best.s, run: () => cast(g, p, c, () => {
      const n = best.t.hp < best.t.maxHp ? 5 : 3;
      payPHP(g, p, 3); if (!g.over && onField(g, best.t)) damage(g, best.t, n, {});
    }) } : null;
  } },
  "Sacrificial Lamb": { needs: x => x.unholy >= 5, play(g, p, c) {
    const us = wasteUnholy(p); if (us.length < 2) return null;
    const s = 6 * phpW(g, p) - 1.2 - (us.length < 4 ? 0.5 : 0);
    return s > 0.3 ? { pri: 3, score: s, run: () => cast(g, p, c, () => { banishFromWaste(g, p, us.slice(0, 2)); gainPHP(g, p, 6); L(g, `  +6 PHP.`); }) } : null;
  } },
  "Market Crash": { goldCost: 5, goldSink: true, play(g, p, c) {
    const cost = goldCostOf(c.d), plus = num(c.d, /gain \+(\d+) ATK/i, 3);
    if (g.phase !== 1 || g.turnNo === 1 || p.gold < cost) return null;
    const att = units(p).filter(u => hasAttr(u.d, "greedy") && !u.attacked && !u.stolen);
    if (!att.length) return null;
    let gain = 0;
    for (const u of att) { const before = Math.max(0, bestAttack(g, u)); u.tAtk += plus; gain += Math.max(0, bestAttack(g, u) - before); u.tAtk -= plus; }
    const s = gain - cost * goldW(g, p) * 0.6 - 0.5;
    return s > 0.5 ? { pri: 3, score: s, run: () => cast(g, p, c, () => { p.gold -= cost; att.forEach(u => { u.tAtk += plus; }); }) } : null;
  } },
  "Blood Frenzy": { needs: x => x.unholy >= 4, play(g, p, c) {
    if (g.phase !== 1 || g.turnNo === 1) return null;
    let best = null;
    for (const u of units(p)) {
      if (!hasAttr(u.d, "unholy") || u.attacked || u.frenzy) continue;
      const before = Math.max(0, bestAttack(g, u));
      u.tAtk += 4; u.tSpd += 1; const fr = u.frenzy; u.frenzy = true;
      const after = bestAttack(g, u);
      u.tAtk -= 4; u.tSpd -= 1; u.frenzy = fr;
      const s = after - before - keepWorth(g, u) + sacrificeBonus(g, p) - 0.8;
      if (!best || s > best.s) best = { u, s };
    }
    return best && best.s > 0.5 ? { pri: 3, score: best.s, run: () => cast(g, p, c, () => { best.u.tAtk += 4; best.u.tSpd += 1; best.u.frenzy = true; L(g, `  ${best.u.d.name} gets +4 ATK and +1 Speed.`); }) } : null;
  } },
  "Blood Pact Summoning Circle": { needs: x => x.unholy >= 4, play(g, p, c) {
    if (g.phase !== 1 || p.pact || !canPay(p, 4) || !p.hand.some(x => x.d.kind === "creature" && hasAttr(x.d, "unholy"))) return null;
    const base = bestPlan(g, p).score; p.pact = 2; const withIt = bestPlan(g, p).score; p.pact = 0;
    const s = withIt - base - 4 * phpW(g, p) - 0.5;
    return s > 0.5 ? { pri: 1, score: s, run: () => cast(g, p, c, () => { payPHP(g, p, 4); p.pact = 2; }) } : null;
  } },
  "Goblin Shuffle": { play(g, p, c) {
    if (g.phase !== 1) return null;
    const back = p.hand.filter(x => x !== c && keepValue(g, p, x) < 3).slice(0, 5);
    const extra = num(c.d, /draw that many cards(?:\s*plus\s*|\s*\+\s*)(\d+)/i, 0);
    if ((!back.length && !extra) || p.deck.length < back.length + extra) return null;
    const gold = back.filter(x => isUnitKind(x.d.kind) && hasAttr(x.d, "greedy")).length;
    const s = gold * 0.9 + back.length * 0.5 + extra * 2.5 - 0.6;
    return s > 0.4 ? { pri: 0, score: s, run: () => cast(g, p, c, () => {
      back.forEach(x => { p.hand.splice(p.hand.indexOf(x), 1); p.deck.unshift(x); });   // the end of the array is the top
      draw(g, p, back.length + extra); gainGold(g, p, gold);
      L(g, `  puts back ${back.length}, draws ${back.length + extra}${gold ? `, +${gold} gold` : ""}.`);
    }) } : null;
  } },
  "Goblin Stock Broker": { goldCost: 3, play(g, p, c) {
    const cost = goldCostOf(c.d), n = num(c.d, /draw (\d+) card/i, 0);
    if (p.gold < cost || p.gold - cost < goldReserve(g, p, c)) return null;
    return { pri: n ? 0 : 3, score: 0.6 + n * 2.5, run: () => cast(g, p, c, () => { p.gold -= cost; p.broker.push(cost); if (n) draw(g, p, n); }) };
  } },
  "Market research": { goldCost: 4, goldSink: true, play(g, p, c) {
    if (g.phase !== 1 || p.gold < 4) return null;
    const pool = p.deck.filter(x => x.d.kind === "creature" && hasAttr(x.d, "greedy"));
    if (!pool.length) return null;
    const soon = pool.filter(x => x.d.flux <= p.maxFlux + 1).sort((a, b) => defValue(b.d) - defValue(a.d));
    const best = soon[0] || pool.sort((a, b) => a.d.flux - b.d.flux)[0];
    const s = 0.6 + (p.hand.filter(x => isUnitKind(x.d.kind)).length < 2 ? 2 : 0) + defValue(best.d) * 0.05 - (p.gold - 4 < goldReserve(g, p, c) ? 1 : 0);
    return s > 0.4 ? { pri: 0, score: s, run: () => cast(g, p, c, () => {
      p.gold -= 4; p.deck.splice(p.deck.indexOf(best), 1); p.hand.push(best); p.st.drawn.add(best.d.ix); shuffle(g.rng, p.deck);
      L(g, `  finds ${best.d.name}.`);
    }) } : null;
  } },
  "Microwave": { play(g, p, c) {
    if (!emptyLanes(p).length) return null;
    let best = null;
    for (const q of g.p) for (const x of q.waste) if (x.d.kind === "creature") { const v = defValue(x.d); if (!best || v > best.v) best = { x, q, v }; }
    if (!best || best.v - 2 <= 0.4) return null;
    const handBest = g.phase === 1 ? Math.max(0, ...p.hand.filter(x => x.d.kind === "creature" && (x.d.flux - (x.d.bp || 0)) <= p.flux).map(x => defValue(x.d))) : 0;
    return { pri: best.v >= Math.max(7, handBest) ? 1 : 3, score: best.v - 2, run: () => cast(g, p, c, () => {
      const i = best.q.waste.indexOf(best.x); if (i < 0 || !emptyLanes(p).length) return;
      best.q.waste.splice(i, 1); materialize(g, p, best.x, chooseLane(g, p, best.x.d), "effect");
    }) };
  } },
  "Pipebomb": { play(g, p, c) {
    const o = foe(g, p), ts = spellsOf(o).filter(z => !z.bomb);
    if (!ts.length) return null;
    const z = ts.find(x => x === o.field) || ts[0];
    return { pri: 1, score: 2.5, run: () => cast(g, p, c, () => { z.bomb = { by: p.i }; L(g, `  Pipebomb is placed on ${z.c.d.name}.`); }) };
  } },
  "Space Squid": { play(g, p, c) {
    if (g.phase !== 1 || g.turnNo === 1 || !emptyLanes(p).length) return null;
    const o = foe(g, p);
    const outlet = units(p).some(u => fxOf(u) && fxOf(u).bpWaste && !p.once.has(u.d.name + ":eat")) || p.hand.some(x => x.d.name === "Blood Frenzy");
    let best = null;
    for (const t of units(o)) {
      let s = valueOf(g, t) * (outlet ? 1.1 : 0.35);
      for (const u of units(p)) if (u.lane === t.lane && !u.attacked) s += expAtk(g, u) * 0.4;
      if (!best || s > best.s) best = { t, s };
    }
    if (!best || best.s - 1.5 <= 0.5) return null;
    return { pri: best.s >= 8 ? 1 : 3, score: best.s - 1.5, run: () => cast(g, p, c, () => steal(g, p, best.t)) };
  } },
  "Unfuse": { play(g, p, c) {
    let best = null;
    for (const t of units(foe(g, p))) if (t.d.kind === "fusion" && t.splices.length) {
      const s = valueOf(g, t) - t.splices.reduce((a, x) => a + defValue(x.d), 0) * 0.8 + 0.2;
      if (!best || s > best.s) best = { t, s };
    }
    return best && best.s > 1 ? { pri: 1, score: best.s, run: () => cast(g, p, c, () => unfuse(g, p, best.t)) } : null;
  } },
  "Overclock": { play(g, p, c) {   // a card under the Reactor for N flux this turn (with Reactor flux it also raises max flux for good)
    if (g.phase !== 1 || p.hand.length < 2) return null;
    const n = num(c.d, /gain (\d+) flux/i, 2);
    const burn = p.hand.filter(x => x !== c).sort((a, b) => holdWorth(a) - holdWorth(b))[0];
    const before = bestPlan(g, p).score, ci = p.hand.indexOf(c), bi = p.hand.indexOf(burn);
    const keep = p.hand.slice(); p.hand = p.hand.filter(x => x !== c && x !== burn); p.flux += n;
    const after = bestPlan(g, p).score; p.flux -= n; p.hand = keep;
    const s = after - before - holdWorth(burn) - 0.5 + (R.ink && p.maxFlux < R.fluxMax ? 2.5 : 0);
    return s > 0.5 ? { pri: 1, score: s, run: () => cast(g, p, c, () => {
      const j = p.hand.indexOf(burn); if (j < 0) return;
      p.hand.splice(j, 1); p.reactor.push(burn); p.flux += n;
      if (R.ink) p.maxFlux = Math.min(R.fluxMax, R.inkBase + p.reactor.length);
      L(g, `  ${burn.d.name} goes under the Reactor: +${n} flux.`);
    }) } : null;
  } },
  "Blood Ledger": { perm: true, score: () => 2.5, acts: [{ id: "draw", pri: 0, ai(g, p, z) {   // pay PHP to draw, once per turn
    const cost = num(z.c.d, /pay (\d+) PHP to draw/i, 3), n = num(z.c.d, /to draw (\d+) card/i, 1);
    if (p.deck.length < n || !canPay(p, cost)) return null;
    const worth = p.hand.length <= 1 ? 3.5 : p.hand.length <= 3 ? 2.5 : p.hand.length < R.handLimit - 1 ? 1.5 : 0;
    return { score: worth * n - cost * phpW(g, p), run: () => { L(g, `${who(g, p)} pays ${cost} PHP to draw (Blood Ledger).`); payPHP(g, p, cost); if (!g.over) draw(g, p, n); } };
  } }] },
  "Divine Silence": { play(g, p, c) {   // before attacking: negate the enemy whose effect is in the way of this turn's attacks
    if (g.phase !== 1 || g.turnNo === 1) return null;
    const mine = units(p).filter(u => !u.attacked && expAtk(g, u) > 0), n = num(c.d, /draw (\d+) card/i, 0);
    if (!mine.length && !n) return null;
    const attacks = () => mine.reduce((s, u) => s + Math.max(0, bestAttack(g, u)), 0), base = attacks();
    let best = null;
    for (const t of units(foe(g, p))) {
      if (!fxOf(t)) continue;
      t.negated = true; const s = attacks() - base; t.negated = false;
      if (!best || s > best.s) best = { t, s };
    }
    if (best) best.s += n * 2.2;
    return best && best.s - 0.8 > 0.5 ? { pri: 1, score: best.s - 0.8, run: () => cast(g, p, c, () => { best.t.negated = true; L(g, `  ${best.t.d.name} is negated until end of turn.`); if (n) draw(g, p, n); }) } : null;
  } },
};

// The card text each effect above was written for (textHash). The editor compares it with the current text.
const FX_TEXT = {
  "Ritual Pit": "1y1hlbr",
  "Bull Run": "1tu3f7v",
  "Goblin Bank": "2h6mga",
  "Cherub": "1i4xkro",
  "Holy Acolyte": "1gn0xd8",
  "Sanctified Knight": "kxmoya",
  "Judicator Angel": "1s5f5uq",
  "Chapel Guard": "rqexuo",
  "Purifier Nun": "1vnz049",
  "Bellkeeper Monk": "1puh9sl",
  "Pain Drinker": "169aojl",
  "Carrion Duchess": "ywk7kl",
  "Nomed The Dark Viscount": "ntpdy7",
  "Renroc The Dark Marquis": "1vm6v6c",
  "Blood Priest": "1eg1uiq",
  "Blood Imp": "1shj6kh",
  "Vein Ripper": "8rzk2y",
  "Flesh Collector": "1q5hw2w",
  "Hemogoblin": "kt81l8",
  "Goblin": "15jv2o1",
  "Penny Stock Goblin": "xjpujb",
  "Sanctuary Bells": "j3nzxp",
  "Seraphim Wall": "1eozs5j",
  "Fallen Angel": "q4xo63",
  "Lord Lazarus": "1bdvnko",
  "Arch Cleric": "jyr4g9",
  "Skinless Titan": "18zgfwi",
  "The Meat Cathedral": "1om48",
  "Ergof The Dark Emperor": "faf0qc",
  "Hop Goblin": "pm1wvk",
  "Divine Silence": "16r81in",
  "Divine Shelter": "103rf6k",
  "Open Vein": "1h3uaxc",
  "Sacrificial Lamb": "14qq9lo",
  "Market Crash": "7o36jn",
  "Loaded Dice": "zx6hut",
  "Blood Frenzy": "j4iw80",
  "Blood Pact Summoning Circle": "1jpgxtw",
  "Goblin Shuffle": "k2msak",
  "Goblin Stock Broker": "clhl85",
  "Energy drink": "idjnd2",
  "Jar of Materialism": "emr87t",
  "Microwave": "1ks3k2m",
  "Pipebomb": "1p8ppap",
  "Space Squid": "15lzgsl",
  "Unfuse": "1i5una4",
  "Goblin General": "v3esdv",
  "Gob-omber": "t7o3k6",
  "Goblin Miner": "jwdpgh",
  "Soul Sucker": "2l5tm3",
  "Archangel": "23e116",
  "Goblin Pit Boss": "1l9geuw",
  "Orc": "1y9qf3n",
  "It's free fuse-estate": "15ldyzt",
  "Crimson Altar": "1svaf0d",
  "Seraph of Judgment": "1io6xgj",
  "Goblin King": "1p28xfm",
  "Goblin Bombardier": "70thxd",
  "Indulgence Seller": "ogn18i",
  "Market research": "1rqsaa3",
};

/* ---------------- the AI ---------------- */
function handCreatureOpts(g, p) {   // hand creatures with every way to pay for them (Blood Price)
  const W = phpW(g, p), spare = Math.floor(wasteSpare(p).length / 2), out = [];
  for (const c of p.hand) {
    const d = c.d; if (d.kind !== "creature" || d.flux == null) continue;
    const opts = [];
    for (let k = 0; k <= (d.bp || 0); k++) {
      const per = num(d, /pay (\d+) PHP(?: per flux)?: reduce this creature's flux cost/i, 3);   // Blood Price, from the card text
      let php = per * k, waste = 0;
      if (d.fx && d.fx.bpWaste) { const w = Math.min(k, spare); waste = 2 * w; php = per * (k - w); }
      opts.push({ flux: d.flux - k, php, waste, cost: php * W + waste * 0.15 });
    }
    out.push({ c, d, value: defValue(d), opts, unholy: hasAttr(d, "unholy") });
  }
  out.sort((a, b) => a.d.ix - b.d.ix);   // copies next to each other, for the de-dupe below
  return out;
}
function bestSubset(g, p, crea, flux, lanes, pact) {
  let best = { score: 0, list: [] };
  const cur = [];
  const rec = (i, fl, ln, sc, php, waste, pactLeft) => {
    if (sc > best.score) best = { score: sc, list: cur.slice() };
    if (!ln) return;
    for (let k = i; k < crea.length; k++) {
      if (k > i && crea[k].d === crea[k - 1].d) continue;   // a second copy only after the first
      const e = crea[k], disc = pactLeft && e.unholy ? pact : 0;
      for (const o of e.opts) {
        const f = o.flux - disc;
        if (f > fl || php + o.php >= p.php || waste + o.waste > p.waste.length) continue;
        cur.push({ e, o });
        rec(k + 1, fl - f, ln - 1, sc + e.value - o.cost, php + o.php, waste + o.waste, pactLeft && !e.unholy);
        cur.pop();
      }
    }
  };
  rec(0, flux, lanes, 0, 0, 0, pact > 0);
  return best;
}
function fusionOpts(g, p) {
  if (p.fused || !p.fdeck.length) return [];
  const out = [];
  const pitZ = spellsOf(p).find(z => z.c.d.fx && z.c.d.fx.pit);
  const pit = !!pitZ && !p.once.has("Ritual Pit") && wasteUnholy(p).length > 0;
  const pitFree = pit && says(pitZ.c.d, /costs no flux|without paying the 2 flux/i);
  const estate = p.hand.find(c => c.d.fx && c.d.fx.estate);
  const altar = !!(p.field && p.field.c.d.fx && p.field.c.d.fx.altar);
  for (const [l1, l2] of [[0, 1], [1, 2]]) {
    const a = p.lanes[l1], b = p.lanes[l2];
    if (!a || !b || a.d.kind !== "creature" || b.d.kind !== "creature") continue;
    const okA = a.d.flux >= R.fuseMin, okB = b.d.flux >= R.fuseMin;
    const usesPit = !(okA && okB);
    if (usesPit && !(pit && ((okA && pitOk(b.d)) || (okB && pitOk(a.d))))) continue;
    const seen = new Set();
    for (const fc of p.fdeck) {
      if (seen.has(fc.d.name)) continue; seen.add(fc.d.name);
      if (!recipeFits(fc.d.recipe, [a.d, b.d])) continue;
      const gain = defValue(fc.d) - keepWorth(g, a) - keepWorth(g, b) - (usesPit ? 0.5 : 0) + 1;
      if (p.flux >= R.fuseFlux) out.push({ gain, flux: R.fuseFlux, lanes: 1, run: () => fuse(g, p, a, b, fc, { kind: "flux", pit: usesPit }) });
      if (pitFree) out.push({ gain: gain - (usesPit ? 0 : 0.5), flux: 0, lanes: 1, run: () => fuse(g, p, a, b, fc, { kind: "pit", pit: true }) });
      if (estate) out.push({ gain: gain - 0.8, flux: 0, lanes: 1, run: () => fuse(g, p, a, b, fc, { kind: "estate", card: estate, pit: usesPit }) });
      if (altar) for (const v of units(p)) if (v !== a && v !== b && hasAttr(v.d, "unholy"))
        out.push({ gain: gain - keepWorth(g, v) + sacrificeBonus(g, p), flux: 0, lanes: 2, run: () => fuse(g, p, a, b, fc, { kind: "altar", victim: v, pit: usesPit }) });
    }
  }
  return out;
}
function bestPlan(g, p) {   // which fusion (if any) and which hand creatures make the most of this turn's flux and lanes
  const crea = handCreatureOpts(g, p), empty = emptyLanes(p).length;
  let best = null;
  for (const fo of [null].concat(fusionOpts(g, p))) {
    const sub = bestSubset(g, p, crea, p.flux - (fo ? fo.flux : 0), empty + (fo ? fo.lanes : 0), p.pact);
    const score = (fo ? fo.gain : 0) + sub.score;
    if (!best || score > best.score) best = { score, fo, sub };
  }
  return best;
}
function naturalPlay(g, p, c, o) {
  let f = o.flux;
  if (p.pact && hasAttr(c.d, "unholy")) { f -= p.pact; p.pact = 0; }
  if (f > p.flux || p.hand.indexOf(c) < 0) return;
  if (o.php) { L(g, `${who(g, p)} pays ${o.php} PHP to lower ${c.d.name}'s cost.`); payPHP(g, p, o.php); if (g.over) return; }
  if (o.waste) banishFromWaste(g, p, wasteSpare(p).slice(0, o.waste));
  p.flux -= f;   // a cost below 0 gives flux
  p.hand.splice(p.hand.indexOf(c), 1);
  materialize(g, p, c, chooseLane(g, p, c.d), "hand");
}
function planOption(g, p) {
  const b = bestPlan(g, p);
  if (!b || b.score <= 0.4) return null;
  if (b.fo) return { pri: 2, score: b.score, run: b.fo.run };
  if (!b.sub.list.length) return null;
  const s = b.sub.list.slice().sort((x, y) => x.o.flux - y.o.flux)[0];
  return { pri: 2, score: b.score, run: () => naturalPlay(g, p, s.e.c, s.o) };
}
function permOption(g, p, c) {
  const f = c.d.fx;
  if (c.d.kind === "field") { if (p.field) return null; }
  else {
    if (!freeZone(p) || p.zones.some(z => z.c.d.name === c.d.name)) return null;
    if (p.zones.length >= R.zones - 1 && p.hand.some(x => x !== c && !isUnitKind(x.d.kind) && !(x.d.fx && x.d.fx.perm))) return null;   // keep a zone for one-shots
  }
  return { pri: 0, score: f.score ? f.score(g, p) : 2, run: () => putInPlay(g, p, c) };
}
// Overclock: the least useful card goes under the Reactor when the extra flux makes this turn's plan better by more than the card is worth
function overclockOption(g, p) {
  // what a card is worth keeping for later: a creature its stats (it will be castable eventually), a spell about 2
  const worth = c => isUnitKind(c.d.kind) ? defValue(c.d) * 0.4 : 2;
  const c = p.hand.slice().sort((a, b) => worth(a) - worth(b))[0], i = p.hand.indexOf(c);
  const before = bestPlan(g, p).score;
  p.hand.splice(i, 1); p.flux += 1; const after = bestPlan(g, p).score; p.flux -= 1; p.hand.splice(i, 0, c);
  return { key: "rule:overclock", pri: 1, score: after - before - worth(c), run: () => {
    const j = p.hand.indexOf(c); if (j < 0) return;
    p.hand.splice(j, 1); p.reactor.push(c); p.flux += 1;
    L(g, `${who(g, p)} overclocks: ${c.d.name} goes under the Reactor for +1 flux.`);
  } };
}
// Reactor choice: Charge, Vent or Overload, whichever helps most now (with the sloppy player's misjudgement, like every choice)
function reactorChoice(g, p) {
  const plan = extra => { p.flux += extra; const s = bestPlan(g, p).score; p.flux -= extra; return s; }, base = plan(0);
  const charge = (p.maxFlux < R.fluxMax ? 2.2 + (plan(1) - base) : 0) + jitter(g, p);
  const vent = (p.hand.length <= 1 ? 3.5 : p.hand.length <= 3 ? 2.5 : p.hand.length < R.handLimit - 1 ? 1.5 : 0) + (p.deck.length ? 0 : -99) + jitter(g, p);
  const overload = (canPay(p, R.overloadPHP) ? plan(2) - base - R.overloadPHP * phpW(g, p) : -99) + jitter(g, p);
  if (charge >= vent && charge >= overload) { p.maxFlux = Math.min(R.fluxMax, p.maxFlux + 1); p.flux += 1; L(g, `  Reactor: Charge (max flux ${p.maxFlux}).`); p.st.reactor[0]++; }
  else if (vent >= overload) { L(g, `  Reactor: Vent, draws a card.`); draw(g, p, 1); p.st.reactor[1]++; }
  else { L(g, `  Reactor: Overload, +2 flux this turn for ${R.overloadPHP} PHP.`); p.flux += 2; losePHP(g, p, R.overloadPHP, { paid: true }); p.st.reactor[2]++; }
}
// what a card in hand is worth keeping, for choosing what goes under the Reactor: a creature its stats, a spell about 2
const holdWorth = c => isUnitKind(c.d.kind) ? defValue(c.d) * 0.4 : 2;
function inkOption(g, p) {   // Reactor flux: the card needed least goes under the Reactor for +1 max flux, usable right away
  const c = p.hand.slice().sort((a, b) => holdWorth(a) - holdWorth(b))[0], i = p.hand.indexOf(c);
  let now = 0;
  if (g.phase === 1) { const before = bestPlan(g, p).score; p.hand.splice(i, 1); p.flux += 1; now = bestPlan(g, p).score - before; p.flux -= 1; p.hand.splice(i, 0, c); }
  const later = 2.5;   // one more flux on every turn from now on
  return { key: "rule:ink", pri: 0, score: now + later - holdWorth(c) + (p.hand.length >= 6 ? 1 : 0), run: () => {
    const j = p.hand.indexOf(c); if (j < 0) return;
    p.hand.splice(j, 1); p.reactor.push(c); p.maxFlux = Math.min(R.fluxMax, p.maxFlux + 1); p.flux += 1;
    L(g, `${who(g, p)} puts ${c.d.name} under the Reactor (max flux ${p.maxFlux}).`);
  } };
}
function bloodDrawOption(g, p) {   // Blood for cards: a card is worth more the emptier the hand
  const worth = p.hand.length <= 1 ? 3.5 : p.hand.length <= 3 ? 2.5 : p.hand.length < R.handLimit - 1 ? 1.5 : 0;
  return { key: "rule:blood", pri: 0, score: worth - 3 * phpW(g, p), run: () => { L(g, `${who(g, p)} pays 3 PHP to draw a card.`); payPHP(g, p, 3); if (!g.over) draw(g, p, 1); } };
}
function mainPhase(g, p) {
  for (let guard = 0; guard < 40 && !g.over; guard++) {
    const opts = [], seen = new Set();
    const add = o => { if (!o) return; o.score += jitter(g, p); if (o.score > 0.4) opts.push(o); };
    for (const c of p.hand) {
      const f = c.d.fx; if (!f || isUnitKind(c.d.kind) || seen.has(c.d.name)) continue;
      seen.add(c.d.name);
      if (f.perm) add(permOption(g, p, c));
      else if (f.play && freeZone(p)) add(f.play(g, p, c));
    }
    for (const u of units(p)) {
      const f = fxOf(u); if (!f || !f.acts) continue;
      for (const a of f.acts) {
        const key = u.d.name + ":" + a.id;
        if (p.once.has(key)) continue;
        const o = a.ai(g, u); if (o) { o.key = key; if (o.pri === undefined) o.pri = a.pri; add(o); }
      }
    }
    for (const z of spellsOf(p)) {
      const f = z.c.d.fx; if (!f || !f.acts) continue;
      for (const a of f.acts) {
        const key = z.c.d.name + ":" + a.id;
        if (p.once.has(key)) continue;
        const o = a.ai(g, p, z); if (o) { o.key = key; if (o.pri === undefined) o.pri = a.pri; add(o); }
      }
    }
    if (R.ink && !p.once.has("rule:ink") && p.hand.length && p.maxFlux < R.fluxMax) add(inkOption(g, p));
    if (R.overclock && g.phase === 1 && !p.once.has("rule:overclock") && p.hand.length) add(overclockOption(g, p));
    if (R.bloodDraw && !p.once.has("rule:blood") && p.deck.length && canPay(p, 3)) add(bloodDrawOption(g, p));
    if (g.phase === 1) add(planOption(g, p));
    if (!opts.length) break;
    opts.sort((a, b) => (a.pri - b.pri) || (b.score - a.score));
    const o = opts[0];
    if (o.key) p.once.add(o.key);
    o.run();
    checkEnd(g);
  }
}
function battle(g, p) {
  const o = foe(g, p);
  for (let guard = 0; guard < 10 && !g.over; guard++) {
    let best = null;
    for (const u of units(p)) {
      if (u.attacked || expAtk(g, u) <= 0 || (R.sick && u.arrived === g.turnNo)) continue;
      for (const l of [u.lane].concat(NB[u.lane])) { const t = o.lanes[l]; if (t) { const s = scoreFight(g, u, t) + jitter(g, p); if (!best || s > best.s) best = { s, u, t }; } }
      if (!o.lanes[u.lane]) { const s = scoreFace(g, u) + jitter(g, p); if (!best || s > best.s) best = { s, u, t: null }; }
    }
    if (!best || best.s <= 0.2) break;
    if (best.t) fight(g, best.u, best.t); else directAttack(g, best.u);
  }
}
function endTurn(g, p) {
  for (const u of units(p)) { const f = fxOf(u); if (f && f.endTurn) f.endTurn(g, u); if (g.over) return; }
  for (const u of units(p)) if (u.frenzy) { sacrifice(g, p, u); if (g.over) return; }
  for (const q of g.p) if (q.field && q.field.c.d.fx && q.field.c.d.fx.endEachTurn) q.field.c.d.fx.endEachTurn(g, q);
  for (const u of units(p)) if (u.stolen) giveBack(g, u);
  for (const u of allUnits(g)) { u.tAtk = 0; u.tSpd = 0; u.negated = false; }
  while (p.hand.length > R.handLimit) {
    const c = p.hand.slice().sort((a, b) => keepValue(g, p, a) - keepValue(g, p, b))[0];
    p.hand.splice(p.hand.indexOf(c), 1); toWaste(g, c);
  }
}
function playTurn(g) {
  const p = g.p[g.active], o = foe(g, p);
  g.turnNo++; p.turns++;
  g.p.forEach(q => q.once.clear());
  p.fused = false; p.pact = 0; g.phase = 0;
  const first = p.turns === 1;
  if (!(first && g.first === p.i)) { draw(g, p, 1); if (g.over) return; }
  if (R.ink) p.maxFlux = Math.min(R.fluxMax, R.inkBase + p.reactor.length);
  else if (!first && !R.reactor) p.maxFlux = Math.min(R.fluxMax, p.maxFlux + 1);
  p.flux = p.maxFlux + (first && g.first !== p.i ? R.secondFlux : 0);
  if (R.reactor && !first) { reactorChoice(g, p); if (g.over) return; }
  L(g, `— Turn ${g.turnNo}: ${who(g, p)} · ${p.php} PHP vs ${o.php} · ${p.flux} flux${p.gold ? ` · ${p.gold} gold` : ""} —`);
  if (g.log) L(g, `  Hand: ${p.hand.map(c => c.d.name).join(", ") || "empty"}.`);
  for (const u of units(p)) { if (u.radHp) { u.hp = Math.min(u.hp, u.maxHp); u.radHp = 0; } u.radAtk = 0; u.attacked = false; u.winded = false; }
  for (const q of g.p) for (const z of spellsOf(q).slice()) if (z.bomb && z.bomb.by === p.i) removeSpell(g, q, z, "Pipebomb");
  for (const c of p.lazarus.splice(0)) { const i = p.waste.indexOf(c); if (i >= 0 && emptyLanes(p).length) { p.waste.splice(i, 1); materialize(g, p, c, chooseLane(g, p, c.d), "lazarus"); } }
  for (const u of units(p)) { const f = fxOf(u); if (f && f.startTurn) f.startTurn(g, u); if (g.over) return; }
  for (const z of spellsOf(p)) { const f = z.c.d.fx; if (f && f.startTurn) f.startTurn(g, p, z); }
  for (const amt of p.broker.splice(0)) {
    if (g.dice() < 0.5) { L(g, `  Goblin Stock Broker: the price rose, +${amt * 2} gold.`); gainGold(g, p, amt * 2); } else L(g, `  Goblin Stock Broker: the price fell.`);
  }
  p.deathMark = g.deaths;
  if (checkEnd(g)) return;
  g.phase = 1; mainPhase(g, p); if (g.over) return;
  if (g.turnNo > 1) { g.phase = 2; battle(g, p); if (g.over) return; }
  g.phase = 3; mainPhase(g, p); if (g.over) return;
  g.phase = 4; endTurn(g, p);
}

/* ---------------- decks and games ---------------- */
function prep(raw) {
  const defs = new Map();
  raw.forEach((d, ix) => defs.set(d.name, Object.assign({}, d, { ix, attrs: (d.attrs || []).map(lc), factions: d.factions || [], fx: FX[d.name] || SPELLS[d.name] || null })));
  return defs;
}
const simulated = d => !!(FX[d.name] || SPELLS[d.name]);
function deckFromList(defs, label, list) {   // list: [[name, copies], ...]
  const main = [], fusion = [];
  for (const [n, q] of list) { const d = defs.get(n); if (!d) continue; for (let k = 0; k < q; k++) (d.kind === "fusion" ? fusion : main).push(n); }
  return { label, arch: label, fixed: true, main, fusion };
}
// A random but sensible deck: 1 faction (sometimes 2), a flux curve, spells that fit it, every fusion it can make.
function randomDeck(defs, rng) {
  const all = [...defs.values()];
  const cre = all.filter(d => d.kind === "creature" && d.flux != null && d.factions.length);
  const facs = [...new Set(cre.flatMap(d => d.factions))].filter(f => cre.filter(d => d.factions.includes(f)).length >= 4).sort();
  if (!facs.length) return null;
  const prim = pick(rng, facs), sec = facs.length > 1 && rng() < 0.35 ? pick(rng, facs.filter(f => f !== prim)) : null;
  const inF = d => d.factions.includes(prim) || (!!sec && d.factions.includes(sec));
  const wshuffle = list => list.map(d => ({ d, k: Math.pow(rng(), 1 / (sec && d.factions.includes(prim) ? 2 : 1)) })).sort((a, b) => b.k - a.k).map(x => x.d);
  const counts = new Map(); let n = 0;
  const add = (d, k) => { const have = counts.get(d.name) || 0; k = Math.max(0, Math.min(k, 3 - have, 30 - n)); if (k) { counts.set(d.name, have + k); n += k; } return k; };
  const copies = () => { const r = rng(); return r < 0.2 ? 1 : r < 0.6 ? 2 : 3; };
  const pool = cre.filter(inF);
  const nCre = 14 + Math.floor(rng() * 6);
  const tier = f => f <= 3 ? 0 : f <= 5 ? 1 : f <= 8 ? 2 : 3, share = [0.36, 0.3, 0.24, 0.1];
  let spill = 0;
  for (let t = 0; t < 4; t++) {
    let want = Math.round(nCre * share[t]) + spill;
    for (const d of wshuffle(pool.filter(d => tier(d.flux) === t))) { if (want <= 0) break; want -= add(d, Math.min(want, copies())); }
    spill = Math.max(0, want);
  }
  for (const d of wshuffle(pool)) { if (n >= nCre) break; add(d, Math.min(nCre - n, copies())); }
  // fusions it can make from its own 5+ flux creatures (or a 3-4 flux Unholy one with Ritual Pit)
  const deckCre = [...counts.keys()].map(k => defs.get(k));
  const pitTargets = deckCre.filter(pitOk).length;
  const canPit = pitTargets && all.some(d => d.name === "Ritual Pit" && inF(d));
  const big = deckCre.filter(d => d.flux >= R.fuseMin);
  const fusions = all.filter(d => d.kind === "fusion" && (big.some((a, i) => big.some((b, j) => (i !== j || counts.get(a.name) > 1) && recipeFits(d.recipe, [a, b])))
    || (canPit && big.some(a => deckCre.some(b => pitOk(b) && recipeFits(d.recipe, [a, b]))))));
  // each fusion it could make goes in 60% of the time, so the stats can compare decks with and without it
  const fcounts = new Map(); let fn = 0;
  for (const d of shuffle(rng, fusions.slice())) { if (rng() >= 0.6) continue; const k = Math.min(10 - fn, rng() < 0.5 ? 1 : 2); if (k > 0) { fcounts.set(d.name, k); fn += k; } }
  const ctx = { fusions: fn, pitTargets, unholy: 0, dice: 0 };
  for (const [k, q] of counts) { const d = defs.get(k); if (hasAttr(d, "unholy")) ctx.unholy += q; if (d.die) ctx.dice += q; }
  const spells = all.filter(d => !isUnitKind(d.kind) && simulated(d) && (!d.factions.length || inF(d)) && !(d.fx && d.fx.needs && !d.fx.needs(ctx)));
  const sw = list => list.map(d => ({ d, k: Math.pow(rng(), 1 / (d.factions.length ? 2 : 1)) })).sort((a, b) => b.k - a.k).map(x => x.d);
  for (const d of sw(spells)) { if (n >= 30) break; const r = rng(); add(d, r < 0.4 ? 1 : r < 0.8 ? 2 : 3); }
  for (let guard = 0; n < 30 && guard < 5; guard++) for (const d of wshuffle(pool.concat(spells))) { if (n >= 30) break; add(d, 1); }
  const expand = m => [...m].flatMap(([k, q]) => Array(q).fill(k));
  const label = prim + (sec ? " + " + sec : "");
  return { label, arch: [prim, sec].filter(Boolean).sort().join(" + "), main: expand(counts), fusion: expand(fcounts), elig: fusions.map(d => d.name) };
}
function newPlayer(g, i, deck) {
  const p = { i, php: R.php, gold: 0, flux: 0, maxFlux: R.ink ? R.inkBase : R.fluxStart, deck: [], hand: [], waste: [], oblivion: [], fdeck: [],
    lanes: [null, null, null], zones: [], field: null, reactor: [], turns: 0, once: new Set(), fused: false, pact: 0,
    broker: [], lazarus: [], deathMark: 0, bullTurn: -1, st: { drawn: new Set(), played: new Set(), fused: new Set(), face: 0, reactor: [0, 0, 0] } };
  const card = d => ({ d, owner: i, uid: g.uid++, lazarusUsed: false });
  deck.main.forEach(n => { const d = g.defs.get(n); if (d) p.deck.push(card(d)); });
  deck.fusion.forEach(n => { const d = g.defs.get(n); if (d) p.fdeck.push(card(d)); });
  shuffle(g.rng, p.deck);
  return p;
}
// opts: { diceSeed, noiseSeed, sigma: [player 1, player 2] }. The same seed always gives the same shuffles and first player.
function playGame(defs, A, B, seed, withLog, opts) {
  opts = opts || {};
  const g = { defs, rng: rngFrom(seed), uid: 1, turnNo: 0, deaths: 0, over: false, winner: -1, endReason: "limit",
    dice: rngFrom(opts.diceSeed !== undefined ? opts.diceSeed : (seed ^ 0x9e3779b9) >>> 0),
    noise: rngFrom(opts.noiseSeed !== undefined ? opts.noiseSeed : (seed ^ 0x85ebca6b) >>> 0), sigma: opts.sigma || [0, 0],
    log: withLog ? [] : null, phase: 0, names: [`P1 (${A.label})`, `P2 (${B.label})`], track: [] };
  g.first = g.rng() < 0.5 ? 0 : 1;
  g.p = [newPlayer(g, 0, A), newPlayer(g, 1, B)];
  g.p.forEach(p => {
    draw(g, p, R.hand);
    const cre = () => p.hand.filter(c => c.d.kind === "creature").length;
    p.st.openCre = cre();
    if (R.redraw && p.st.openCre <= 1) {
      L(g, `${who(g, p)} redraws an opening hand with ${p.st.openCre} creature${p.st.openCre === 1 ? "" : "s"}.`);
      p.deck.push(...p.hand.splice(0)); shuffle(g.rng, p.deck); draw(g, p, R.hand);
    }
    // the hand plus the next cards of the deck (the end of the array is the top): what this player gets early, by luck
    p.top = [...new Set(p.hand.concat(p.deck.slice(-Math.max(0, R.early - p.hand.length))).map(c => c.d.ix))];
  });
  L(g, `${who(g, g.p[g.first])} goes first.`);
  g.active = g.first;
  const board = p => units(p).reduce((s, u) => s + valueOf(g, u), 0);
  while (!g.over && g.turnNo < R.turnLimit * 2) {
    playTurn(g);
    g.track.push([g.p[0].php, g.p[1].php, board(g.p[0]), board(g.p[1])]);   // the position after every turn
    if (!g.over) g.active = 1 - g.active;
  }
  if (!g.over) { g.over = true; g.winner = -1; g.endReason = "limit"; L(g, `Turn limit reached: draw.`); }
  else L(g, g.winner < 0 ? "Both players hit 0 PHP: draw." : `${g.names[g.winner]} wins (${g.p[0].php} PHP vs ${g.p[1].php}).`);
  return g;
}
// How the game went for its winner, turn by turn. "Lead" = PHP difference + half the difference in board value
// (a creature's value is roughly ATK + HP/2), so a player with a big board but fewer PHP isn't counted as behind.
function closeness(g) {
  const w = g.winner; if (w < 0 || !g.track.length) return null;
  const l = 1 - w, lead = s => (s[w] - s[l]) + 0.5 * (s[2 + w] - s[2 + l]);
  let changes = 0, prev = 0, behind = 0, phpBehind = 0, lastNotAhead = -1;
  g.track.forEach((s, i) => {
    const d = lead(s), sign = d >= 3 ? 1 : d <= -3 ? -1 : 0;
    if (sign && prev && sign !== prev) changes++;
    if (sign) prev = sign;
    behind = Math.max(behind, -d); phpBehind = Math.max(phpBehind, s[l] - s[w]);
    if (d < 3) lastNotAhead = i;
  });
  const s6 = g.track[5], d6 = s6 ? lead(s6) : 0;   // after 3 turns each
  return { margin: g.p[w].php, changes, behind: Math.round(behind), phpBehind, decided: (lastNotAhead + 1) / g.track.length,
    ahead6: !s6 || Math.abs(d6) < 3 ? -1 : d6 > 0 ? w : l };
}
function record(g, A, B) {
  const uniq = list => [...new Set(list.map(n => g.defs.get(n).ix))];
  return { w: g.winner, t: g.turnNo, end: g.endReason, f: g.first, c: closeness(g), p: [A, B].map((D, i) => {
    const p = g.p[i];
    return { label: D.label, arch: D.arch, fixed: !!D.fixed, main: uniq(D.main), fus: uniq(D.fusion), elig: D.elig ? uniq(D.elig) : null, top: p.top,
      drawn: [...p.st.drawn], played: [...p.st.played], fused: [...p.st.fused], php: p.php, face: p.st.face, fc: p.st.firstCre || 99, oc: p.st.openCre, ff: p.st.firstFuse || 0, rc: p.st.reactor };
  }) };
}
// o: { count, start, seed, fixed: [{ label, cards: [[name, copies]] }], mode, sigma, replays }. Saved decks play every other game,
// against a random deck. mode "skill" and "replay" are the luck-vs-skill tests (see the editor's Gameplay section).
// Game number start + k always gets the same decks and dice, however the games are split between workers.
function runMany(raw, o, onBatch) { return withRules(o.rules, () => runManyNow(raw, o, onBatch)); }
function runManyNow(raw, o, onBatch) {
  const defs = prep(raw);
  const fixed = (o.fixed || []).map(d => deckFromList(defs, d.label, d.cards)).filter(d => d.main.length);
  const recs = []; let chunk = [];
  for (let k = 0; k < o.count; k++) {
    const gi = o.start + k, seed = (Math.imul(o.seed >>> 0, 1000003) + Math.imul(gi, 7919)) >>> 0, rng = rngFrom(seed ^ 0x5bd1e995);
    let A = randomDeck(defs, rng); const B = randomDeck(defs, rng);
    if (!A || !B) break;
    let r;
    if (o.mode === "skill") {   // the same deck on both sides: a careful player against one with sloppy judgement (sigma)
      const careful = gi % 2, sigma = careful ? [o.sigma, 0] : [0, o.sigma];
      const g = playGame(defs, A, Object.assign({}, A, { label: A.label + " (copy)" }), seed, false, { sigma });
      r = { w: g.winner, careful, arch: A.arch, t: g.turnNo };
    } else if (o.mode === "replay") {   // the same shuffled decks again, with fresh dice and slightly different decisions
      const ws = [];
      for (let k = 0; k < (o.replays || 4); k++) ws.push(playGame(defs, A, B, seed, false, { diceSeed: (seed + 7 + k * 1013) >>> 0, noiseSeed: (seed + 11 + k * 2029) >>> 0, sigma: [o.sigma, o.sigma] }).winner);
      r = { ws, arch: [A.arch, B.arch] };
    } else {
      if (fixed.length && gi % 2 === 1) A = fixed[((gi - 1) / 2) % fixed.length];
      r = record(playGame(defs, A, B, seed, false), A, B);
    }
    recs.push(r); chunk.push(r);
    if (onBatch && chunk.length >= 10) { onBatch(chunk); chunk = []; }
  }
  if (onBatch && chunk.length) onBatch(chunk);
  return recs;
}
function coverage(raw) {   // which cards the sim plays without their effect, or wrote for older text
  const missing = [], changed = [];
  raw.forEach(d => {
    const rest = String(d.text || "").replace(/\{[^}]*\}?/, "").replace(/\s+/g, " ").trim();
    if (!FX[d.name] && !SPELLS[d.name]) { if (rest && !/^pay \d+ php( per flux)?: reduce this creature's flux cost by (up to )?\d+\.?$/i.test(rest)) missing.push(d.name); }
    else if (FX_TEXT[d.name] && FX_TEXT[d.name] !== textHash(d.text)) changed.push(d.name);
  });
  return { missing, changed };
}

if (typeof importScripts === "function" && typeof window === "undefined") {   // running as a Web Worker
  self.onmessage = e => {
    const m = e.data;
    try { runMany(m.defs, m, recs => self.postMessage({ type: "batch", recs })); self.postMessage({ type: "done" }); }
    catch (err) { self.postMessage({ type: "error", message: String(err && err.stack || err) }); }
  };
}
return { R, RULEBOOK, withRules, FX, SPELLS, FX_TEXT, textHash, rngFrom, prep, randomDeck, deckFromList, playGame, record, runMany, coverage };
})();
