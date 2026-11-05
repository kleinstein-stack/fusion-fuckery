/* Fusion Fuckery battle simulator (Rulebook v4.7, gameplay v2).
   Plays whole games between two decks with a rule-of-thumb AI, so the editor's Battle sim tab can play thousands
   of them and show which cards and combinations win too often. No DOM in here: tools/build.ps1 inlines this file
   into the editor, which runs it on the page (to watch one game) and in Web Workers (for big runs).
   Card effects are written per card name in FX (creatures, fusions) and SPELLS. A card without an entry plays with
   its stats only and the editor lists it. FX_TEXT remembers the card text each effect was written for, so the
   editor can say when a card's text has changed since. */
var BattleSim = (function () {
"use strict";

const R = { speedNormal: 4, speedScale: 0.5, coinTie: true,   // v4.6: Speed 1-8 and a coin flip on a speed tie
  descend: true, fine: 3, complaintAtk: 2,   // v4.7: Descend (Angels) and the 2 flux fine that removes a Complaint (Mundane)
  php: 30, hand: 5, fluxStart: 3, fluxMax: 10, secondFlux: 1, lanes: 3, fuseMin: 5, fuseFlux: 2,
  handLimit: 8, zones: 3, emptyDeck: 5, turnLimit: 40,   // turnLimit: turns per player before the game is a draw
  early: 12,   // the stats look at which cards were in the top 12 of the shuffled deck (opening hand + about 7 draws)
  redraw: true,   // v4.3: a player whose opening hand has 0 or 1 creatures shuffles it back and draws a new one, once
  sick: true,   // v4.3: creatures and fusions can't attack the turn they arrive (taking control of one isn't arriving)
  // Rules to try, aimed at giving players more decisions that matter (ideas from Magic, Lorcana, Pokemon and Yu-Gi-Oh!):
  winded: true,       // v4.4: a creature that attacked can't hit back until its controller's next turn (Magic's tapping, Lorcana's exert)
  intercept: false,   // a creature next to a direct attacker may step in front of it and fight it instead (Magic's blocking)
  overclock: false,   // once per turn: put a card from your hand under your Reactor for +1 flux this turn (Lorcana's inkwell)
  bloodDraw: false,   // once per turn: pay 3 PHP to draw a card (a consistency engine, like Pokemon's draw Supporters)
  // Reactor flux, a structural change (Lorcana's inkwell): no automatic +1 a turn. Once per turn you may put a card from your
  // hand face down under your Reactor; your max flux is inkBase + the cards under it (up to fluxMax), and the new flux is usable at once.
  ink: false, inkBase: 2,
  // Reactor Phase choices: normally +1 max flux (up to 10) and refill. You may also Feed the reactor: send 1 card from your
  // hand to Oblivion for +1 flux this turn (not max flux). Or Skip: no +1 max flux this turn, still refill, draw 1 extra card.
  // Feed and Skip don't combine; the normal draw always happens. holdAtCap: whether you may Skip once max flux is already 10.
  reactor: true, holdAtCap: true,   // v4.4
  // v4.5 fusion rules: a new fusion is winded; it keeps the damage its fusion splices had (and dies if that's its HP or
  // more); two fusions can be fused; Unfuse splits the fusion's damage between the splices it returns (never below
  // 1 HP) and they stay winded if it was; on a direct attack, winded creatures next to the attacker still hit back, last.
  fuseWinded: true, carryDamage: true, fuseFusions: true, unfuseSplit: true, windedBackLast: true };
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
const fxOf = u => u.negated || u.frog ? null : u.d.fx;
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
// rolls: how many dice are rolled to keep the highest (true = 2, as in "roll twice"); E[max] = sum over j of 1 - ((j-1)/n)^rolls
const dieAvg = (n, rolls) => {
  if (!n) return 0;
  const k = rolls === true ? 2 : Math.max(1, rolls || 1);
  if (k === 1) return (n + 1) / 2;
  let s = 0; for (let j = 1; j <= n; j++) s += 1 - Math.pow((j - 1) / n, k); return s;
};

/* ---------------- stats the AI and the rules read ---------------- */
function advantage(g, u) {
  if (!u.die) return false;
  const f = fxOf(u); if (f && f.selfAdvantage) return true;
  if (!hasAttr(u.d, "greedy")) return false;
  return units(g.p[u.ctrl]).some(k => { const kf = fxOf(k); return kf && (kf.greedyAdvantage === "all" || (kf.greedyAdvantage === "others" && k !== u)); });
}
// how many times u rolls its die and keeps the highest: 2 with advantage; Hop Goblin rolls once per fusion splice (v4.5)
function rollCount(g, u) {
  const f = fxOf(u);
  return Math.max(advantage(g, u) ? 2 : 1, f && f.rollPerSplice ? spliceCount(u) : 1);
}
function atkOf(g, u) {   // ATK without the die
  if (u.frog) return 1;   // a Frog: Polymorph, Wild Magic's "Oops" (v4.7)
  let a = u.atk + u.pAtk + u.tAtk + u.radAtk - R.complaintAtk * (u.complaints || 0);   // a Complaint (v4.7): -2 ATK each
  const p = g.p[u.ctrl];
  for (const k of units(p)) { const f = fxOf(k); if (f && f.aura) a += f.aura(g, k, u); }
  for (const z of spellsOf(p)) { const f = z.c.d.fx; if (f && f.aura) a += f.aura(g, p, u); }
  return Math.max(0, a);
}
const expAtk = (g, u) => atkOf(g, u) + dieAvg(u.die, rollCount(g, u));
const speedOf = u => u.spd + u.tSpd;
const fieldFx = (g, key) => g.p.some(q => q.field && q.field.c.d.fx && q.field.c.d.fx[key]);   // Field Spells affect both sides
// Plushies: Fluffy creatures need their controller's Claw Machine (Field Spell). Without one they can't be
// materialized, and the ones on the field are destroyed.
const fluffy = x => hasAttr(x.d, "fluffy");
const isClaw = c => !!(c.d.fx && c.d.fx.claw);
const hasClaw = p => !!(p.field && isClaw(p.field.c));
function clawCheck(g) {
  for (const p of g.p) if (!hasClaw(p)) for (const u of units(p)) if (fluffy(u) && onField(g, u) && says(u.d, /destroyed if you stop controlling/i)) {
    L(g, `  ${who(g, p)} has no Claw Machine, so ${u.d.name} is destroyed.`); destroy(g, u, {}); if (g.over) return;
  }
}
// Claw Machine: a Fluffy creature may attack the player directly past the creature in front of it (which hits back),
// unless the opponent controls a Fluffy creature
const bypass = (g, u) => fluffy(u) && hasClaw(g.p[u.ctrl]) && says(g.p[u.ctrl].field.c.d, /attack your opponent directly/i) && !units(foe(g, g.p[u.ctrl])).some(fluffy);
const canFace = (g, u) => !foe(g, g.p[u.ctrl]).lanes[u.lane] || bypass(g, u);
function tutor(g, p, pick) {   // search the deck: pick(card) -> a score, or null if it can't be taken. Shuffles after.
  let best = null;
  for (const c of p.deck) { const s = pick(c); if (s != null && (!best || s > best.s)) best = { c, s }; }
  if (!best) return null;
  p.deck.splice(p.deck.indexOf(best.c), 1); p.hand.push(best.c); shuffle(g.rng, p.deck);
  L(g, `  ${who(g, p)} searches the deck for ${best.c.d.name}.`);
  return best.c;
}
// Does the attacker strike before e? The attacker gets +1 Speed. Twisted Dimensions reverses speed: the slower creature
// strikes first and the attacker gets -1 Speed instead. A tie is a coin flip (v4.6; before that the attacker won ties).
// real: an actual fight flips the coin; the AI's previews count a tie as the defender striking first.
function attFirst(g, att, e, real) {
  const trick = fieldFx(g, "trick"), a = speedOf(att) + (trick ? -1 : 1), b = speedOf(e), d = trick ? b - a : a - b;
  if (d !== 0) return d > 0;
  if (!R.coinTie) return true;
  if (!real) return false;
  const first = g.dice() < 0.5; L(g, `  Speed tie: the coin says ${first ? att.d.name : e.d.name} strikes first.`); return first;
}
const spdWorth = s => (s - R.speedNormal) * R.speedScale;
function valueOf(g, u) { const f = fxOf(u); return expAtk(g, u) + Math.max(0, u.hp) / 2 + spdWorth(speedOf(u)) + (f && f.value || 0); }
const defValue = d => d.atk + dieAvg(d.die) + d.hp / 2 + spdWorth(d.spd) + (d.fx && d.fx.value || 0);
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
  if (f && f.returns && spliceCount(u) > 0) v *= 0.5;
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
  // Seraphim Wall: banish one of its fusion splices so a creature you control survives with 1 HP instead
  for (const k of units(g.p[u.ctrl])) {
    const kf = fxOf(k);
    if (!kf || !kf.savior || !spliceCount(k) || keepWorth(g, u) < (k === u ? 0 : 3) + spliceCost(k)) continue;
    banishSplice(g, k); u.hp = 1; L(g, `  ${u.d.name} survives with 1 HP (${k.d.name}).`); return false;
  }
  destroy(g, u, info);
  return true;
}
const toWaste = (g, c) => {
  if (c.stealTo != null) { const q = g.p[c.stealTo]; c.stealTo = null; q.deck.splice(Math.floor(g.dice() * (q.deck.length + 1)), 0, c); return; }   // Thiefling Sleight of Hand
  g.p[c.owner].waste.push(c);
};
// Fusion splices (v4.5): a fusion used as a fusion splice keeps its own splices under it (card.under), so stacks nest.
// "Fusion splices under this creature" counts every card in the stack.
const under = list => list.flatMap(c => [c].concat(c.under ? under(c.under) : []));
const spliceCount = u => under(u.splices).length;
const wasteAll = (g, list) => under(list).forEach(c => { c.under = null; toWaste(g, c); });
const spliceCost = u => { const f = fxOf(u); return 1 + (f && f.perSplice || 0); };   // what keeping one splice is worth
// Banish the least useful fusion splice that has nothing under it. Returns the card, or null if there's none.
function banishSplice(g, u) {
  let best = null;
  const walk = list => list.forEach((c, i) => {
    if (c.under && c.under.length) walk(c.under);
    else { const v = defValue(c.d); if (!best || v < best.v) best = { list, i, c, v }; }
  });
  walk(u.splices);
  if (!best) return null;
  best.list.splice(best.i, 1); best.c.under = null; g.p[best.c.owner].oblivion.push(best.c);
  L(g, `  ${u.d.name}: banishes its fusion splice ${best.c.d.name}.`);
  return best.c;
}
function destroy(g, u, info) {
  const p = g.p[u.ctrl];
  if (p.lanes[u.lane] !== u) return;
  p.lanes[u.lane] = null;
  const f = fxOf(u);
  g.deaths++;
  L(g, `  ${u.d.name} is destroyed${info.sacrifice ? " (sacrificed)" : ""}.`);
  if (f && f.returns && spliceCount(u) > 0) {   // Lord Lazarus: banish a splice, come back next turn with the rest
    banishSplice(g, u); u.c.under = u.splices; toWaste(g, u.c); g.p[u.c.owner].lazarus.push(u.c);
  } else wasteAll(g, [u.c].concat(u.splices));
  if (info.src && info.combat) { const kf = fxOf(info.src); if (kf && kf.onKill && onField(g, info.src)) kf.onKill(g, info.src, u); }
  if (f && f.onDeath) f.onDeath(g, u, info);
  // Claw Machine: once per turn, when one of your Fluffy creatures is destroyed, draw a card
  if (fluffy(u) && hasClaw(p) && says(p.field.c.d, /fluffy' creatures? you control is destroyed: draw/i) && !p.once.has("Claw Machine:draw")) {
    p.once.add("Claw Machine:draw"); L(g, `  Claw Machine: ${who(g, p)} draws a card.`); draw(g, p, 1);
  }
  if (fluffy(u)) for (const k of units(p)) { const kf = fxOf(k); if (kf && kf.fluffyDraw && k !== u && says(k.d, /fluffy' creature you control dies: draw/i)) { L(g, `  ${k.d.name}: ${who(g, p)} draws a card.`); draw(g, p, 1); } }
  for (const k of allUnits(g)) { const kf = fxOf(k); if (kf && kf.onAnyDeath) kf.onAnyDeath(g, k, u); }
}
function banishUnit(g, u) {
  const p = g.p[u.ctrl];
  if (p.lanes[u.lane] !== u) return;
  p.lanes[u.lane] = null;
  u.c.under = null; g.p[u.c.owner].oblivion.push(u.c); wasteAll(g, u.splices);
  L(g, `  ${u.d.name} is banished.`);
}
// Dinos (v4.6): "Fossil X" brings a creature back from your Waste Repository by banishing X other cards there instead of
// paying flux; milling puts the top cards of a deck into its owner's Waste Repository.
const fossilOf = d => { const m = String(d.text || "").match(/Fossil (\d+) \(/); return m ? +m[1] : null; };
const prehistoric = c => isUnitKind(c.d.kind) && hasAttr(c.d, "prehistoric");
function mill(g, p, n) {
  n = Math.min(n, p.deck.length); if (!n) return;
  for (let k = 0; k < n; k++) toWaste(g, p.deck.pop());
  L(g, `  ${who(g, p)} puts the top ${n} card${n > 1 ? "s" : ""} of the deck into the Waste Repository.`);
}
function fossilFuel(p, keep, x) {   // what the AI banishes first: spells, then creatures that can't come back, then other Fossils
  const rank = c => isUnitKind(c.d.kind) ? (fossilOf(c.d) != null ? 3 + defValue(c.d) / 20 : 1 + defValue(c.d) / 40) : 0;
  return p.waste.filter(c => c !== keep && !p.lazarus.includes(c)).sort((a, b) => rank(a) - rank(b)).slice(0, x);
}
function fossilRaise(g, p, c, x) {   // banish x other Waste Repository cards (0 = free) and materialize c from there
  const lane = emptyLanes(p).length ? chooseLane(g, p, c.d) : null; if (lane == null) return null;
  const fuel = fossilFuel(p, c, x); if (fuel.length < x) return null;
  banishFromWaste(g, p, fuel);
  const i = p.waste.indexOf(c); if (i < 0) return null;
  p.waste.splice(i, 1);
  if (x) L(g, `  ${who(g, p)} banishes ${x} card${x > 1 ? "s" : ""} from the Waste Repository (Fossil ${x}).`);
  return materialize(g, p, c, lane, "fossil");
}
function bestFossil(g, p, free) {   // the Prehistoric creature in p's Waste Repository most worth bringing back
  let best = null;
  for (const c of p.waste) {
    const x = free ? 0 : fossilOf(c.d); if (x == null || !prehistoric(c) || p.lazarus.includes(c)) continue;
    const fuel = fossilFuel(p, c, x); if (fuel.length < x) continue;
    const loss = fuel.reduce((s, f) => s + (fossilOf(f.d) != null ? 2 : isUnitKind(f.d.kind) ? 0.6 : 0.3), 0);
    const s = defValue(c.d) * 0.8 - loss;
    if (!best || s > best.s) best = { c, x, s };
  }
  return best;
}
function fossilOption(g, p) {
  if (g.phase !== 1 || !emptyLanes(p).length) return null;
  const b = bestFossil(g, p, false);
  return b && b.s > 1 ? { pri: 2, score: b.s, run: () => fossilRaise(g, p, b.c, b.x) } : null;
}
const ankyOf = (g, u) => { const f = fxOf(u); return f && f.reduceFirst && u.ankyTurn !== g.turnNo ? f.reduceFirst : 0; };
function banishFromWaste(g, p, list) {
  let n = 0; for (const c of list) { const i = p.waste.indexOf(c); if (i >= 0) { p.waste.splice(i, 1); p.oblivion.push(c); n++; } }
  if (n) for (const u of units(p)) { const f = fxOf(u); if (f && f.onWasteBanish) f.onWasteBanish(g, u, n); }   // Fossil Fuel Baron
}
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
  if (lane == null || p.lanes[lane] || (fluffy(c) && !hasClaw(p))) return null;
  const u = makeUnit(g, p, c, lane, how === "lazarus");
  if (c.under) { u.splices = c.under; c.under = null; }   // Lord Lazarus comes back with its other splices
  p.lanes[lane] = u;
  if (c.owner === p.i && how !== "lazarus") p.st.played.add(c.d.ix);
  if (!p.st.firstCre) p.st.firstCre = p.turns;
  L(g, `${who(g, p)} ${how === "hand" ? "plays" : how === "lazarus" ? "brings back" : how === "fossil" ? "digs up" : how === "descend" ? "descends with" : "materializes"} ${c.d.name} (${LANE[lane]} lane)${how === "lazarus" ? " at half stats" : how === "fossil" || how === "waste" ? " from the Waste Repository" : ""}.`);
  const f = fxOf(u); if (f && f.onPlay) f.onPlay(g, u);
  if (f && f.onRaise && (how === "fossil" || how === "waste") && onField(g, u)) f.onRaise(g, u);
  return u;
}
function cast(g, p, c, effect) {   // a one-shot Spell or Instant: it uses a spell zone while it resolves
  const i = p.hand.indexOf(c); if (i < 0) return;
  p.hand.splice(i, 1);
  if (c.owner === p.i) p.st.played.add(c.d.ix);
  L(g, `${who(g, p)} casts ${c.d.name}.`);
  spellPlayed(g, p, c);
  if (g.over || countered(g, p, c)) { toWaste(g, c); return; }
  effect();
  if (!g.over && archmageTwice(g, p)) { L(g, `  The Archmage: ${c.d.name} resolves again.`); effect(); }
  toWaste(g, c);
}
function putInPlay(g, p, c) {   // Continuous or Field Spell
  const i = p.hand.indexOf(c); if (i < 0) return;
  p.hand.splice(i, 1);
  if (c.owner === p.i) p.st.played.add(c.d.ix);
  L(g, `${who(g, p)} puts ${c.d.name} into play.`);
  spellPlayed(g, p, c);
  if (g.over || countered(g, p, c)) { toWaste(g, c); return; }
  if (c.d.kind === "field") { if (p.field) toWaste(g, p.field.c); p.field = { c }; } else p.zones.push({ c });
  clawCheck(g);   // replacing a Claw Machine destroys your plushies
}
function removeSpell(g, q, z, why) {
  if (q.field === z && isClaw(z.c)) {   // Mega Plush: banish a fusion splice instead, and the Claw Machine stays
    const k = units(q).find(u => { const f = fxOf(u); return f && f.clawGuard && spliceCount(u) > 0; });
    if (k) { banishSplice(g, k); L(g, `  ${k.d.name} keeps the Claw Machine in play.`); return; }
  }
  if (q.field === z) q.field = null; else { const i = q.zones.indexOf(z); if (i < 0) return; q.zones.splice(i, 1); }
  toWaste(g, z.c);
  L(g, `  ${z.c.d.name} is destroyed${why ? " by " + why : ""}.`);
  clawCheck(g);
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
const fuseDamage = u => Math.max(0, u.maxHp - Math.min(u.hp, u.maxHp));   // the damage a creature carries into a fusion
// b: the unit in the lane next to a, or { card, d } for Shotgun Wedding (a creature card from the hand)
function fuse(g, p, a, b, fc, pay) {
  const fromHand = !!b.card;
  if (!onField(g, a) || (!fromHand && !onField(g, b)) || p.fused || p.fdeck.indexOf(fc) < 0) return;
  if (fromHand && p.hand.indexOf(b.card) < 0) return;
  if (pay.wedding) { const i = p.hand.indexOf(pay.wedding); if (i < 0) return; p.hand.splice(i, 1); if (pay.wedding.owner === p.i) p.st.played.add(pay.wedding.d.ix); L(g, `${who(g, p)} casts ${pay.wedding.d.name}.`); toWaste(g, pay.wedding); spellPlayed(g, p, pay.wedding); }
  if (pay.kind === "flux") p.flux -= R.fuseFlux;
  else if (pay.kind === "estate") { const i = p.hand.indexOf(pay.card); if (i < 0) return; p.hand.splice(i, 1); if (pay.card.owner === p.i) p.st.played.add(pay.card.d.ix); L(g, `${who(g, p)} casts ${pay.card.d.name}.`); toWaste(g, pay.card); spellPlayed(g, p, pay.card); }
  else if (pay.kind === "altar") { sacrifice(g, p, pay.victim); if (g.over || !onField(g, a) || (!fromHand && !onField(g, b))) return; }
  if (pay.pit) { const c = wasteUnholy(p)[0]; if (c) banishFromWaste(g, p, [c]); p.once.add("Ritual Pit"); }
  const parts = fromHand ? [a] : [a, b];
  const lane = fromHand ? a.lane : a.lane === 1 || b.lane === 1 ? 1 : a.lane;
  const carried = R.carryDamage ? parts.reduce((s, x) => s + fuseDamage(x), 0) : 0;
  parts.forEach(x => { p.lanes[x.lane] = null; });
  if (fromHand) { p.hand.splice(p.hand.indexOf(b.card), 1); if (b.card.owner === p.i) p.st.played.add(b.card.d.ix); }
  p.fdeck.splice(p.fdeck.indexOf(fc), 1);
  const u = makeUnit(g, p, fc, lane, false);
  // a fusion used as a splice keeps its own stack under it
  u.splices = parts.map(x => { x.c.under = x.splices.length ? x.splices : null; return x.c; }).concat(fromHand ? [b.card] : []);
  if (R.fuseWinded) u.winded = true;
  p.lanes[lane] = u; p.fused = true; p.st.fused.add(fc.d.ix);
  if (!p.st.firstFuse) p.st.firstFuse = g.turnNo;
  L(g, `${who(g, p)} fuses ${a.d.name} + ${b.d.name}${fromHand ? " (from the hand, Shotgun Wedding)" : ""} into ${fc.d.name}${pay.kind === "estate" ? " for free (It's Free Fuse-Estate)" : pay.kind === "altar" ? " (Crimson Altar instead of flux)" : ""}${pay.pit ? " (Ritual Pit)" : ""}${parts.some(x => x.d.kind === "fusion") ? ` (${spliceCount(u)} fusion splices)` : ""}.`);
  if (carried) {
    u.hp -= carried;
    L(g, `  ${fc.d.name} keeps the ${carried} damage its fusion splices had (${Math.max(0, u.hp)}/${u.maxHp}).`);
    if (u.hp <= 0) { kill(g, u, {}); return; }
  }
  const f = fxOf(u); if (f && f.onPlay) f.onPlay(g, u);
}
// Unfuse: the fusion goes back to its owner's Fusion Deck and its fusion splices come back at full HP, sharing the
// fusion's damage evenly (the bigger one takes the odd point), never below 1 HP. Winded stays winded.
function unfuse(g, by, u) {
  const p = g.p[u.ctrl];
  if (!onField(g, u)) return;
  p.lanes[u.lane] = null;
  g.p[u.c.owner].fdeck.push(u.c);
  // shares: half each for the usual 2 splices (a banished splice's share is simply gone)
  const dmg = R.unfuseSplit ? fuseDamage(u) : 0, back = [], parts = Math.max(2, u.splices.length);
  L(g, `  ${u.d.name} breaks back into ${u.splices.map(c => c.d.name).join(" + ") || "nothing"}.`);
  u.splices.forEach((c, k) => {
    const q = g.p[c.owner], lane = k === 0 && q === p ? u.lane : emptyLanes(q)[0];
    if (lane === undefined) { wasteAll(g, [c]); return; }
    const x = makeUnit(g, q, c, lane, false);
    if (c.under) { x.splices = c.under; c.under = null; }
    if (R.unfuseSplit && u.winded) x.winded = true;
    q.lanes[lane] = x; back.push(x);
  });
  if (dmg && back.length) {
    back.sort((x, y) => y.maxHp - x.maxHp).forEach((x, k) => {
      const share = Math.floor(dmg / parts) + (k < dmg % parts ? 1 : 0), n = Math.min(share, x.hp - 1);
      if (n > 0) { x.hp -= n; L(g, `  ${x.d.name} comes back with ${n} of the damage (${x.hp}/${x.maxHp}).`); }
    });
  }
}
function steal(g, p, u, until) {   // Space Squid: until the end of this turn, or (v4.6) the start of your next turn
  const o = g.p[u.ctrl], free = emptyLanes(p);
  if (!free.length || !onField(g, u) || u.ctrl === p.i) return;
  const lane = free.includes(u.lane) ? u.lane : free[0];
  o.lanes[u.lane] = null;
  u.stolen = { home: u.lane, until: until || "end" }; u.ctrl = p.i; u.lane = lane; u.attacked = false; u.winded = false;
  p.lanes[lane] = u;
  L(g, `  ${who(g, p)} takes control of ${u.d.name} for the turn.`);
}
function giveBack(g, u) {
  const p = g.p[u.ctrl], o = g.p[u.owner];
  p.lanes[u.lane] = null;
  const lane = !o.lanes[u.stolen.home] ? u.stolen.home : emptyLanes(o)[0];
  u.stolen = null;
  if (lane === undefined) { wasteAll(g, [u.c].concat(u.splices)); L(g, `  ${u.d.name} has no lane to go back to and goes to the Waste Repository.`); return; }
  u.ctrl = o.i; u.lane = lane; o.lanes[lane] = u;
}

/* ---------------- combat ---------------- */
function guardOf(g, u) {   // Sanctified Knight: 1 less combat damage for creatures next to it
  let n = 0; const p = g.p[u.ctrl];
  for (const l of NB[u.lane]) { const k = p.lanes[l], f = k && fxOf(k); if (f && f.guardNeighbors) n += f.guardNeighbors; }
  if (hasAttr(u.d, "ordinary")) for (const k of units(p)) { const f = k !== u && fxOf(k); if (f && f.guardOrdinary) n += f.guardOrdinary; }   // Gregg's Dawg
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
  const p = g.p[u.ctrl], o = foe(g, p), rolls = rollCount(g, u), greedy = hasAttr(u.d, "greedy");
  const once = () => { let r = 1 + Math.floor(g.dice() * u.die); for (let k = 1; k < rolls; k++) r = Math.max(r, 1 + Math.floor(g.dice() * u.die)); return r; };
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
  if (ctx.tax && ctx.tax.u === tgt && n > 0) { const pr = Math.min(n, ctx.tax.left); n -= pr; ctx.tax.left -= pr; }   // Tax Evasion
  const anky = n > 0 ? ankyOf(g, tgt) : 0; if (anky) { n = Math.max(0, n - anky); tgt.ankyTurn = g.turnNo; }   // Ankylosaurus
  L(g, `  ${src.d.name} hits ${tgt.d.name} for ${n}${rolled ? ` (rolled ${rolled})` : ""}${ctx.shelter === tgt ? " (Divine Shelter)" : ""}.`);
  if (n <= 0) return 0;
  const before = tgt.hp, foeP = g.p[tgt.ctrl];
  const dealt = damage(g, tgt, n, { src, combat: true });
  const f = fxOf(src); if (f && f.onCombatDamage) f.onCombatDamage(g, src, dealt);
  if (n > before && !onField(g, tgt) && !g.over && says(src.d, /Stampede \(/) && (ctx.attack || !says(src.d, /Stampede \(when this creature attacks/i))) {   // Stampede: the leftover hits the player
    L(g, `  Stampede: ${n - Math.max(0, before)} damage carries through to ${who(g, foeP)}.`); losePHP(g, foeP, n - Math.max(0, before), { combat: true });
  }
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
function expHit(g, src, tgt) { return Math.max(0, expAtk(g, src) - guardOf(g, tgt) - ankyOf(g, tgt)); }
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
  else if (attFirst(g, att, def)) { dHp -= expHit(g, att, def); if (survives(def, dHp)) aHp -= expHit(g, def, att); }
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
// The enemies next to a direct attacker that hit it back: by speed (backs), and winded ones that hit last (v4.5)
function hitBacks(g, att) {
  const o = foe(g, g.p[att.ctrl]), near = NB[att.lane].map(l => o.lanes[l]).filter(Boolean);
  // Claw Machine: attacking past the creature in front, it hits back too (older wording; now it's slipped past)
  if (o.lanes[att.lane] && says(g.p[att.ctrl].field ? g.p[att.ctrl].field.c.d : {}, /in front of them hits back/i)) near.push(o.lanes[att.lane]);
  return { backs: near.filter(canHitBack), late: R.windedBackLast ? near.filter(e => !canHitBack(e)) : [] };
}
function scoreFace(g, att) {
  const p = g.p[att.ctrl], o = foe(g, p);
  const blocker = interceptChoice(g, att, false);
  if (blocker) return scoreFight(g, att, blocker);   // expect the block
  const { backs, late } = hitBacks(g, att);
  let hp = att.hp, face = 0;
  for (const e of backs) if (!attFirst(g, att, e)) hp -= expHit(g, e, att);
  if (survives(att, hp)) {
    face = expAtk(g, att); if (hp <= 0) hp = 1;
    for (const e of backs) if (attFirst(g, att, e)) hp -= expHit(g, e, att);
    for (const e of late) hp -= expHit(g, e, att);
  }
  const ka = keepWorth(g, att), dies = !survives(att, hp);
  const w = face >= o.php ? 100 : 0.55 + 6 / Math.max(1, o.php - face);
  return face * w - (dies ? ka : ((att.hp - Math.max(0, hp)) / Math.max(1, att.maxHp)) * ka * 0.5) - (dies ? 0 : exposure(g, att, hp));
}
function bestAttack(g, u) {   // AI: the best score u can get from one attack this turn
  const o = foe(g, g.p[u.ctrl]); let best = -Infinity;
  if ((R.sick && u.arrived === g.turnNo) || lockedOut(g, u)) return best;   // it can't attack (yet)
  for (const l of [u.lane].concat(NB[u.lane])) if (o.lanes[l]) best = Math.max(best, scoreFight(g, u, o.lanes[l]));
  if (canFace(g, u)) best = Math.max(best, scoreFace(g, u));
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
    watchToll(g, att); if (g.over) return;
    const f = fxOf(att); if (f && f.onAttack) f.onAttack(g, att, def);
    if (g.over || !onField(g, att) || !onField(g, def)) return;
    const dsc = descendResponse(g, o, att, def);
    if (dsc) { if (g.over || !onField(g, att)) return; def = dsc; }
  }
  const ctx = { shelter: null, tax: null };
  shelterResponse(g, o, att, def, ctx);
  taxResponse(g, o, att, def, ctx);
  if (g.over || !onField(g, att) || !onField(g, def)) return;
  const back = canHitBack(def);
  if (!back) L(g, `  ${def.d.name} is winded and can't hit back.`);
  const first = !back || attFirst(g, att, def, true), a = first ? att : def, b = first ? def : att;
  strike(g, a, b, { shelter: ctx.shelter, tax: ctx.tax, attack: a === att });
  if (onField(g, a) && onField(g, b) && (b === att || back)) strike(g, b, a, { shelter: ctx.shelter, tax: ctx.tax, attack: b === att });
}
function directAttack(g, att) {
  const p = g.p[att.ctrl], o = foe(g, p);
  att.attacked = true; if (R.winded) att.winded = true;
  L(g, `${att.d.name} attacks ${who(g, o)} directly.`);
  watchToll(g, att); if (g.over) return;
  const f = fxOf(att); if (f && f.onAttack) f.onAttack(g, att, null);
  if (g.over || !onField(g, att)) return;
  const dsc = descendResponse(g, o, att, null);
  if (dsc) { if (g.over || !onField(g, att)) return; return fight(g, att, dsc, true); }
  const blocker = interceptChoice(g, att, true);
  if (blocker) { L(g, `  ${blocker.d.name} steps in front of it.`); return fight(g, att, blocker, true); }
  const { backs, late } = hitBacks(g, att), early = new Set(backs.filter(e => !attFirst(g, att, e, true)));
  for (const e of backs) if (early.has(e)) strike(g, e, att, {});
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
  for (const e of backs) if (!early.has(e) && onField(g, att) && onField(g, e)) strike(g, e, att, {});
  for (const e of late) if (onField(g, att) && onField(g, e)) { L(g, `  ${e.d.name} is winded, so it hits back last.`); strike(g, e, att, {}); }
}


/* ---------------- v4.7: Complaints, Descend, Spellcount ---------------- */
// Mundane: a Complaint gives -2 ATK (atkOf) and stops "once per turn" effects (mainPhase). Its controller may pay a fine
// (3 flux, +1 for each HOA President the other player controls) in their Main Phase to remove one.
function complain(g, u, n) {
  if (!onField(g, u)) return;
  u.complaints = (u.complaints || 0) + (n || 1);
  L(g, `  ${u.d.name} gets a Complaint (${u.complaints}).`);
}
const copLock = (g, q) => units(q).some(k => { const f = fxOf(k); return f && f.copLock; });   // Mall Cop Gary
const lockedOut = (g, u) => !!u.complaints && copLock(g, foe(g, g.p[u.ctrl]));
function fineCost(g, p) { let n = R.fine; for (const k of units(foe(g, p))) { const f = fxOf(k); if (f && f.fineUp) n += 1; } return n; }
function complaintWorth(g, p, u) {   // what one more Complaint on the enemy u is worth to p
  if (!onField(g, u) || u.ctrl === p.i) return -1;
  const f = fxOf(u);
  let s = Math.min(2, atkOf(g, u)) * 0.6 * (u.complaints ? 0.8 : 1) + 0.2;
  if (!u.complaints && f && f.acts) s += 1.5;
  if (!u.complaints && copLock(g, p)) s += expAtk(g, u) * 0.4;
  return s;
}
function bestComplaint(g, p, skip) {
  let best = null;
  for (const u of units(foe(g, p))) { if (skip && skip.includes(u)) continue; const s = complaintWorth(g, p, u); if (!best || s > best.s) best = { u, s }; }
  return best;
}
function payFine(g, p, u, cost) {
  if (!onField(g, u) || !u.complaints || p.flux < cost) return;
  p.flux -= cost; u.complaints--;
  L(g, `${who(g, p)} pays a ${cost} flux fine: ${u.d.name} loses a Complaint (${u.complaints} left).`);
  for (const k of units(foe(g, p))) { const f = fxOf(k); if (f && f.onFine) f.onFine(g, k); }
}
function fineOption(g, p) {   // AI: pay a fine when the creature is worth more than what the flux would do this turn
  const cost = fineCost(g, p); if (p.flux < cost) return null;
  let best = null;
  for (const u of units(p)) {
    if (!u.complaints || u.stolen) continue;
    const look = () => valueOf(g, u) + (g.phase === 1 ? Math.max(0, bestAttack(g, u)) : 0);
    const before = look(); u.complaints--; const after = look() + (!u.complaints && fxOf(u) && fxOf(u).acts ? 1.5 : 0); u.complaints++;
    if (!best || after - before > best.s) best = { u, s: after - before };
  }
  if (!best) return null;
  let spend = 0;
  if (g.phase === 1) { const b0 = bestPlan(g, p).score; p.flux -= cost; spend = b0 - bestPlan(g, p).score; p.flux += cost; }
  spend += descendHold(g, p, cost);
  const s = best.s - spend - 0.3;
  return s > 0.4 ? { pri: 1, score: s, run: () => payFine(g, p, best.u, cost) } : null;
}
function watchToll(g, att) {   // Neighborhood Watch: an attacker with a Complaint costs its controller 2 PHP
  if (!att.complaints) return;
  const p = g.p[att.ctrl], n = foe(g, p).zones.filter(z => z.watch).length; if (!n) return;
  L(g, `  Neighborhood Watch: ${who(g, p)} loses ${2 * n} PHP.`); losePHP(g, p, 2 * n);
}
function taxResponse(g, o, att, def, ctx) {   // Tax Evasion: up to 5 less combat damage to an Ordinary creature, a Complaint on the attacker
  if (!hasAttr(def.d, "ordinary") || ctx.shelter === def) return;
  const c = o.hand.find(x => x.d.fx && x.d.fx.tax); if (!c || !freeZone(o)) return;
  const r = previewFight(g, att, def), v = valueOf(g, def);
  if ((r.dDies && v >= 4) || r.dLoss >= 4) cast(g, o, c, () => { ctx.tax = { u: def, left: num(c.d, /prevent up to (\d+)/i, 5) }; complain(g, att); });
}
const anyCost = d => says(d, /made from creatures of any flux cost/i);
// Angels: Descend. When an enemy creature attacks, materialize a Descend creature from your hand with the flux you have
// left (it isn't refilled until your Reactor Phase); the attack hits it instead.
const descendOf = c => c.d.kind === "creature" && says(c.d, /Descend \(/);
function descDisc(g, p) {
  let n = 0;
  for (const u of units(p)) { const f = fxOf(u); if (f && f.descDisc) n += num(u.d, /Descends cost (\d+) less flux/i, 1); }
  for (const z of spellsOf(p)) if (says(z.c.d, /Descends cost (\d+) less flux/i)) n += num(z.c.d, /Descends cost (\d+) less flux/i, 1);
  return n;
}
const descendCost = (g, p, c) => Math.max(0, (c.d.flux || 0) - descDisc(g, p));
function descendHold(g, p, spend) {   // on your own turn: the flux you'd want left for a Descend
  if (!R.descend) return 0;
  const costs = p.hand.filter(descendOf).map(c => descendCost(g, p, c)); if (!costs.length) return 0;
  const m = Math.min(...costs);
  return p.flux >= m && p.flux - spend < m ? 1.5 : 0;
}
function fightWorth(g, o, att, x, xWorth) {   // the fight att vs o's x, for o
  const r = previewFight(g, att, x);
  return (r.aDies ? killWorth(g, o, att) : (r.aLoss / Math.max(1, att.maxHp)) * valueOf(g, att) * 0.6)
    - (r.dDies ? xWorth : (r.dLoss / Math.max(1, x.maxHp)) * xWorth * 0.5);
}
function descendResponse(g, o, att, target) {
  if (!R.descend || g.active === o.i || !emptyLanes(o).length) return null;
  const face = expAtk(g, att);
  const was = target ? fightWorth(g, o, att, target, keepWorth(g, target)) : -face * phpW(g, o) * (face >= o.php ? 100 : 1);
  let best = null;
  for (const c of o.hand) {
    if (!descendOf(c) || (fluffy(c) && !hasClaw(o))) continue;
    const cost = descendCost(g, o, c); if (cost > o.flux) continue;
    const lane = chooseLane(g, o, c.d), v = makeUnit(g, o, c, lane, false), vw = defValue(c.d);
    const kill = num(c.d, /destroy the attacking creature if it has (\d+) HP or less/i, 0), minus = num(c.d, /attacking creature gets -(\d+) ATK/i, 0);
    let s;
    if (kill && att.hp <= kill) s = killWorth(g, o, att) + 1;
    else { att.tAtk -= minus; s = fightWorth(g, o, att, v, vw); att.tAtk += minus; }
    s -= was;
    if (!best || s > best.s) best = { c, cost, lane, s };
  }
  if (!best || best.s + jitter(g, o) <= 0.6) return null;
  o.flux -= best.cost; o.hand.splice(o.hand.indexOf(best.c), 1);
  const u = materialize(g, o, best.c, best.lane, "descend"); if (!u) return null;
  L(g, `  ${u.d.name} descends in front of ${att.d.name} (${best.cost} flux).`);
  const f = fxOf(u); if (f && f.onDescend) f.onDescend(g, u, att);
  return onField(g, u) ? u : null;
}
// Wizards: Spellcount = the spells a player has played this turn (a spell counts itself). Pipebomb negates a spell as it's
// played; The Archmage makes the first one-shot spell each turn resolve twice.
function spellPlayed(g, p, c) {
  p.sc = (p.sc || 0) + 1;
  if (g.log && p.sc >= 2) L(g, `  (Spellcount ${p.sc})`);
  for (const u of units(p)) { const f = fxOf(u); if (f && f.onSpell) f.onSpell(g, u, c); if (g.over) return; }
  if (p.sc === 3) for (const q of g.p) if (q.field && q.field.c.d.fx && q.field.c.d.fx.college) { L(g, `  Community College of Magic: ${who(g, p)} gains 1 flux.`); p.flux += 1; }
}
const drawOk = (p, n) => p.deck.length >= n + 6;   // the AI stops drawing extra cards before its deck runs out
function countered(g, p, c) {
  if (g.countering) return false;
  const o = foe(g, p), steal = o.hand.find(x => x.d.fx && x.d.fx.steal && x.d.kind === "instant");   // Thiefling Sleight of Hand first
  const pb = steal || o.hand.find(x => x.d.fx && x.d.fx.pipebomb && (says(x.d, /negate a spell/i) || (x.d.kind === "instant" && says(x.d, /spell card, destroy it/i))));
  if (!pb || !freeZone(o)) return false;
  const worth = (g.pendingWorth != null ? g.pendingWorth : 2) + jitter(g, o) + (steal ? 0.5 : 0);
  if (worth < 4) return false;
  g.countering = true; cast(g, o, pb, () => {}); g.countering = false;
  if (steal) { c.stealTo = o.i; L(g, `  Thiefling Sleight of Hand: ${c.d.name} does nothing and is shuffled into ${who(g, o)}'s deck.`); }
  else L(g, `  Pipebomb: ${c.d.name} is negated.`);
  return true;
}
function archmageTwice(g, p) {
  if (p.once.has("The Archmage:twice") || !units(p).some(u => { const f = fxOf(u); return f && f.twice; })) return false;
  p.once.add("The Archmage:twice"); return true;
}
const oneShot = c => !isUnitKind(c.d.kind) && !!(c.d.fx && c.d.fx.play);
// "You can only play this if your Spellcount is 3 or more" (Abracadabra, Extra Credit): this spell would be at least the 3rd
const scOk = (p, c) => !says(c.d, /only play this if your spellcount is (\d+) or more/i) || (p.sc || 0) + 1 >= num(c.d, /spellcount is (\d+) or more/i, 3);
function spellBack(g, p, filter) {   // the best spell in p's Waste Repository back to the hand
  const list = p.waste.filter(c => !isUnitKind(c.d.kind) && c.d.fx && (!filter || filter(c)) && !p.lazarus.includes(c));
  if (!list.length) return null;
  const c = list.sort((a, b) => (b.d.factions.length ? 1 : 0) - (a.d.factions.length ? 1 : 0) || holdWorth(b) - holdWorth(a))[0];
  p.waste.splice(p.waste.indexOf(c), 1); p.hand.push(c); L(g, `  ${c.d.name} goes back to ${who(g, p)}'s hand.`);
  return c;
}
function discardWorst(g, p) {
  if (!p.hand.length) return null;
  const c = p.hand.slice().sort((a, b) => keepValue(g, p, a) - keepValue(g, p, b))[0];
  p.hand.splice(p.hand.indexOf(c), 1); toWaste(g, c); L(g, `  ${who(g, p)} discards ${c.d.name}.`);
  return c;
}
function frogify(g, u, until) {   // Polymorph: 1 ATK and no effects until the end of the caster's next turn; its HP stays,
  if (!onField(g, u) || u.frog) return;   // and when it turns back it has the HP it had before (damage taken as a Frog is gone)
  u.frog = { until, die: u.die, hp: u.hp }; u.die = 0;
  L(g, `  ${u.d.name} is a Frog (1 ATK, no effects) until ${until > g.turnNo ? "the end of the next turn" : "end of turn"}.`);
}
function bounce(g, u) {   // Abracadabra: back to its owner's hand (never a fusion), as a new card
  if (!onField(g, u)) return;
  g.p[u.ctrl].lanes[u.lane] = null;
  g.p[u.owner].hand.push(u.c);
  L(g, `  ${u.d.name} goes back to ${who(g, g.p[u.owner])}'s hand.`);
}
function bounceWorth(g, p, t) {   // sending an enemy creature back: it has to be paid for again, but its damage is gone
  const v = valueOf(g, t);
  return v * 0.4 + Math.min(t.d.flux || 0, foe(g, p).maxFlux) * 0.35 - ((t.maxHp - t.hp) / Math.max(1, t.maxHp)) * v * 0.35 - (t.complaints || 0) * 1.2;
}
const bounceTargets = (g, p) => units(foe(g, p)).filter(t => t.d.kind !== "fusion").map(t => ({ t, s: bounceWorth(g, p, t) })).filter(x => x.s > 0.3).sort((a, b) => b.s - a.s);
function swapStats(g, u) {   // Spelling Mistake: its ATK becomes its current HP and its HP its current ATK; later changes still apply
  if (!onField(g, u)) return;
  const a = atkOf(g, u), h = u.hp;
  u.atk = h; u.pAtk = 0; u.hp = a; u.maxHp = a; u.radHp = 0;
  L(g, `  ${u.d.name} swaps its ATK and HP: ${h} ATK, ${a} HP.`);
  if (u.hp <= 0) kill(g, u, {});
}
function swapWorth(g, p, t) {   // AI: what swapping t's ATK and HP is worth to p (null: not worth trying)
  if (t.frog) return null;
  const a = atkOf(g, t); if (a <= 0) return killWorth(g, p, t);
  const mine = t.ctrl === p.i, sv = { atk: t.atk, pAtk: t.pAtk, hp: t.hp, maxHp: t.maxHp, radHp: t.radHp };
  const fights = () => g.phase === 1 ? Math.max(0, ...units(p).filter(u => !u.attacked).map(u => mine ? (u === t ? bestAttack(g, u) : -Infinity) : ([u.lane].concat(NB[u.lane]).includes(t.lane) ? scoreFight(g, u, t) : -Infinity))) : 0;
  const v0 = valueOf(g, t), f0 = fights();
  t.atk = t.hp; t.pAtk = 0; t.hp = a; t.maxHp = a; t.radHp = 0;
  const v1 = valueOf(g, t), f1 = fights();
  Object.assign(t, sv);
  return mine ? (f1 - f0) + (v1 - v0) * 0.3 - 0.8 : (v0 - v1) + Math.max(0, f1 - f0) - 0.4;
}
// Wild Magic: a d6. 1 Oops (your highest-ATK creature is a Frog), 2 +2 ATK for everything, 3 draw 2, 4 +3 flux,
// 5 5 damage to an enemy creature, 6 roll twice more. Spellcount 3+: roll twice and keep the better result.
const topAtk = (g, p) => units(p).sort((a, b) => atkOf(g, b) - atkOf(g, a))[0] || null;
function wildWorth(g, p, r) {
  const o = foe(g, p);
  if (r === 1) { const u = topAtk(g, p); return u ? -(g.phase === 1 && !u.attacked ? Math.max(0, atkOf(g, u) - 1) * 0.4 : 0) - (u.d.fx ? 0.8 : 0) : 0; }
  if (r === 2) return g.phase === 1 ? units(p).filter(u => !u.attacked && !(R.sick && u.arrived === g.turnNo)).length * 1.4 - units(o).length * 0.5 : -units(o).length * 0.3;
  if (r === 3) return drawOk(p, 2) ? 4.5 : 0.5;
  if (r === 4) return g.phase === 1 ? 2.2 : p.hand.some(x => x.d.name === "Big Fireball") ? 1.5 : 0.2;
  if (r === 5) return Math.max(0, ...units(o).map(t => damageWorth(g, p, t, 5)));
  return 4;
}
function wildMagic(g, p, choose, depth) {
  const roll = () => 1 + Math.floor(g.dice() * 6);
  let r = roll();
  if (choose) { const r2 = roll(); L(g, `  Wild Magic rolls ${r} and ${r2}.`); if (wildWorth(g, p, r2) > wildWorth(g, p, r)) r = r2; }
  L(g, `  Wild Magic: ${r}.`);
  const o = foe(g, p);
  if (r === 1) { const u = topAtk(g, p); if (u) { L(g, `  Oops.`); frogify(g, u, g.turnNo); } }
  else if (r === 2) { for (const u of allUnits(g)) u.tAtk += 2; L(g, `  Every creature gets +2 ATK.`); }
  else if (r === 3) draw(g, p, 2);
  else if (r === 4) { p.flux += 3; L(g, `  ${who(g, p)} gains 3 flux.`); }
  else if (r === 5) { let best = null; for (const t of units(o)) { const s = damageWorth(g, p, t, 5); if (!best || s > best.s) best = { t, s }; } if (best) damage(g, best.t, 5, {}); }
  else if (depth < 3) { wildMagic(g, p, false, depth + 1); if (!g.over) wildMagic(g, p, false, depth + 1); }
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
  const n = spliceCount(u); if (!n) return;   // 1 damage for each fusion splice under it
  p.once.add(key); L(g, `  Fallen Angel deals ${n} damage to ${t.d.name}.`); damage(g, t, n, {});
}
function chooseLane(g, p, d) {
  const free = emptyLanes(p); if (free.length <= 1) return free[0];
  let best = free[0], bs = -Infinity;
  for (const l of free) {
    let s = 0;
    if (d.flux >= R.fuseMin || pitOk(d) || fieldFx(g, "pot") || p.fdeck.some(fc => anyCost(fc.d))) for (const nl of NB[l]) {
      const nu = p.lanes[nl];
      if (nu && (nu.d.kind === "creature" || R.fuseFusions) && p.fdeck.some(fc => recipeFits(fc.d.recipe, [d, nu.d]))) s += 4;
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
  "Acolyte Adam": { value: 2, acts: [healAct(2, false)] },
  "Sanctified Knight": { value: 2, guardNeighbors: 1 },
  "Judicator Angel": { value: 2, onAttack(g, u) { if (!says(u.d, /when this creature attacks: restore/i)) return; const p = g.p[u.ctrl]; NB[u.lane].forEach(l => { if (p.lanes[l]) restoreHP(g, p, p.lanes[l], 2); }); },
    onDescend(g, u, att) { const n = num(u.d, /attacking creature gets -(\d+) ATK/i, 0); if (n) { att.tAtk -= n; L(g, `  ${att.d.name} gets -${n} ATK until end of turn.`); } } },
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
  "Bellkeeper Monk": { value: 3, descDisc: true, startTurn(g, u) {
    const p = g.p[u.ctrl], n = says(u.d, /2 HP while 'Sanctuary Bells'/i) && g.p.some(q => q.field && q.field.c.d.fx && q.field.c.d.fx.bells) ? 2 : 1;
    units(p).forEach(t => restoreHP(g, p, t, n));
  } },
  "Gabe": { value: 2, acts: [healAct(2, true)], onDescend(g, u, att) {
    const n = num(u.d, /destroy the attacking creature if it has (\d+) HP or less/i, 0);
    if (n && att.hp <= n && onField(g, att)) { L(g, `  Gabe destroys ${att.d.name}.`); kill(g, att, {}); }
  } },
  "Beelzechud": { value: 1, onLosePHP(g, u) { u.tAtk += 1; } },
  "Carrion The Dark Duchess": { value: 3, endTurn(g, u) {
    const p = g.p[u.ctrl], cost = num(u.d, /pay (\d+) PHP to return/i, 2), maxHp = num(u.d, /with (\d+) or less max HP/i, 5);
    if (!emptyLanes(p).length || !canPay(p, cost)) return;
    let best = null;
    for (const c of p.waste) if (c.d.kind === "creature" && hasAttr(c.d, "unholy") && c.d.hp <= maxHp) { const v = defValue(c.d); if (!best || v > best.v) best = { c, v }; }
    if (!best || best.v - cost * phpW(g, p) <= 0.5) return;
    L(g, `${who(g, p)} pays ${cost} PHP (Carrion The Dark Duchess).`);
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
  "Salem": { value: 3, bpWaste: true, acts: [{ id: "eat", pri: 3, ai(g, u) {
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
  "Mountain Orc": { value: 1, orc: true },
  // v4.5 fusions: each one uses its fusion splices, either per splice under it or by banishing one (banishSplice).
  // perSplice: what one extra splice is worth to the AI when it fuses fusions together.
  "Seraphim Wall": { value: 3, guardNeighbors: 1, savior: true, perSplice: 1 },
  "Fallen Angel": { value: 3, perSplice: 1, onYouRestore(g, u) { angelZap(g, u); }, onLosePHP(g, u, n, info) { if (info.paid) angelZap(g, u); } },
  "Lord Lazarus": { value: 4, returns: true, perSplice: 2 },
  "Arch Cleric": { value: 3, perSplice: 0.8, startTurn(g, u) { const p = g.p[u.ctrl], n = num(u.d, /start of your turn: restore (\d+) HP/i, 3), t = bestHeal(g, p, n); if (t && t.s > 0) restoreHP(g, p, t.u, n); },
    acts: [{ id: "mend", pri: 3, ai(g, u) {
      const p = g.p[u.ctrl]; if (!spliceCount(u) || u.stolen) return null;
      const n = num(u.d, /to restore (\d+) HP to a creature you control/i, 6), t = bestHeal(g, p, n); if (!t) return null;
      const s = t.s - spliceCost(u);
      return s > 0.5 ? { score: s, run: () => { if (banishSplice(g, u)) restoreHP(g, p, t.u, n); } } : null;
    } }] },
  "Beelzechad": { value: 2, perSplice: 0.8,
    endTurn(g, u) {
      const p = g.p[u.ctrl];
      if (spliceCount(u) && 2 * phpW(g, p) > spliceCost(u) * 0.7) { banishSplice(g, u); return; }   // instead of losing 2 PHP
      L(g, `  Beelzechad: ${who(g, p)} loses 2 PHP.`); losePHP(g, p, 2, {});
    },
    onLosePHP(g, u) { u.tAtk += 1; },
    onKill(g, u) { L(g, `  Beelzechad deals 2 damage to each enemy creature.`); units(foe(g, g.p[u.ctrl])).forEach(t => damage(g, t, 2, {})); } },
  "The Meat Cathedral": { value: 4, perSplice: 0.6,   // +2 ATK on sacrifices (older text) or when its own banish takes a creature (v4.5 text)
    sacValue: (g, u) => says(u.d, /whenever you sacrifice a creature/i) ? 2 : 0,
    onSacrifice(g, u) { if (says(u.d, /whenever you sacrifice a creature/i)) u.pAtk += 2; }, acts: [{ id: "feast", pri: 3, ai(g, u) {
    const p = g.p[u.ctrl], grow = says(u.d, /whenever you banish creature/i);
    const spare = grow ? wasteSpare(p).sort((a, b) => isUnitKind(b.d.kind) - isUnitKind(a.d.kind)) : wasteSpare(p), useWaste = spare.length >= 2;
    if (!useWaste && (!spliceCount(u) || u.stolen)) return null;
    const k = num(u.d, /restore (\d+) HP to a creature or gain/i, 5), t = bestHeal(g, p, k), hs = t ? t.s : 0, ps = k * phpW(g, p), s = Math.max(hs, ps) - (useWaste ? 0.6 : spliceCost(u)) + (grow && (!useWaste || spare.slice(0, 2).some(c => isUnitKind(c.d.kind))) ? 1.2 : 0);
    return s > 0.3 ? { score: s, run: () => {
      const ate = useWaste ? spare.slice(0, 2).some(c => isUnitKind(c.d.kind)) : true;
      if (useWaste) banishFromWaste(g, p, spare.slice(0, 2)); else if (!banishSplice(g, u)) return;
      if (hs >= ps) restoreHP(g, p, t.u, k); else { L(g, `  The Meat Cathedral: +${k} PHP.`); gainPHP(g, p, k); }
      if (grow && ate && onField(g, u)) u.pAtk += num(u.d, /gains \+(\d+) ATK permanently/i, 2);
    } } : null;
  } }] },
  "Ergof The Dark Emperor": { value: 5, perSplice: 1.5, acts: [{ id: "destroy", pri: 1, ai(g, u) {
    const p = g.p[u.ctrl], splice = spliceCount(u) > 0 && !u.stolen; let best = null;
    for (const t of units(foe(g, p))) {
      if (t.hp <= 6 && canPay(p, 3)) { const s = killWorth(g, p, t) - 3 * phpW(g, p); if (!best || s > best.s) best = { t, s, how: "php" }; }
      if (t.hp <= 10 && splice) { const s = killWorth(g, p, t) - spliceCost(u); if (!best || s > best.s) best = { t, s, how: "splice" }; }
    }
    return best && best.s > 0.5 ? { score: best.s, run: () => {
      if (best.how === "php") { L(g, `${u.d.name} pays 3 PHP to destroy ${best.t.d.name}.`); payPHP(g, p, 3); }
      else { if (!banishSplice(g, u)) return; L(g, `${u.d.name} destroys ${best.t.d.name}.`); }
      if (!g.over && onField(g, best.t)) kill(g, best.t, {});
    } } : null;
  } }] },
  "Hop Goblin": { value: 3, rollPerSplice: true, perSplice: 1.2, goldSink: true, acts: [investAct(2)] },
  "Scrooger": { value: 3, perSplice: 1,
    aura(g, k, u) { return k === u ? spliceCount(u) : 0; },   // +1 ATK for each fusion splice under it
    onAnyDeath(g, u, dead) {
      const p = g.p[u.ctrl], q = g.p[dead.c.owner], i = q.waste.indexOf(dead.c);
      if (dead.ctrl === u.ctrl && dead.d.kind === "creature" && i >= 0 && !q.lazarus.includes(dead.c)) {
        q.waste.splice(i, 1); u.splices.push(dead.c); L(g, `  Scrooger takes ${dead.d.name} as a fusion splice (${spliceCount(u)}).`); return;
      }
      if (goldW(g, p) > phpW(g, p)) gainGold(g, p, 1); else gainPHP(g, p, 1);
    } },
  "Seraph of Judgment": { value: 2, perSplice: 1, onAttack(g, u) {
    const p = g.p[u.ctrl], n = spliceCount(u) * num(u.d, /restore (\d+) HP to each creature you control for each/i, 1);
    if (n) units(p).forEach(k => restoreHP(g, p, k, n));
  } },
  "Goblin King": { value: 4, perSplice: 1, greedyAdvantage: "all", wantsGold5: true, startTurn(g, u) { gainGold(g, g.p[u.ctrl], spliceCount(u)); },
    aura(g, k, u) { return hasAttr(u.d, "greedy") ? Math.floor(g.p[k.ctrl].gold / 5) : 0; } },
  "Goblin Bombardier": { value: 4, perSplice: 0.8, goldSink: true, acts: [{ id: "bomb", pri: 1, ai(g, u) {
    const p = g.p[u.ctrl], o = foe(g, p); let best = null;
    const m = String(u.d.text || "").match(/deal (\d+) damage to an enemy creature and (\d+) to/i), fixed = m ? [+m[1], +m[2]] : null;   // v4.6: a splice for a fixed hit
    const worth = (t, x, side) => { let s = damageWorth(g, p, t, x); for (const l of NB[t.lane]) if (o.lanes[l]) s += damageWorth(g, p, o.lanes[l], side != null ? side : Math.floor(x / 2)); return s; };
    for (const t of units(o)) {
      if (!fixed) for (let x = 1; x <= p.gold; x++) { const s = worth(t, x) - x * goldW(g, p) * 0.6; if (!best || s > best.s) best = { t, x, s, splice: false }; }
      if (spliceCount(u) && !u.stolen) { const s = worth(t, fixed ? fixed[0] : 4, fixed && fixed[1]) - spliceCost(u); if (!best || s > best.s) best = { t, x: fixed ? fixed[0] : 4, s, splice: true }; }
    }
    return best && best.s > 1 ? { score: best.s, run: () => {
      const side = NB[best.t.lane].map(l => o.lanes[l]).filter(Boolean);
      if (best.splice) { if (!banishSplice(g, u)) return; } else { p.gold -= best.x; L(g, `${who(g, p)} pays ${best.x} gold (Goblin Bombardier).`); }
      damage(g, best.t, best.x, {}); side.forEach(t => damage(g, t, fixed && best.splice ? fixed[1] : Math.floor(best.x / 2), {}));
    } } : null;
  } }] },
  "Indulgence Seller": { value: 3, perSplice: 0.8, goldSink: true, acts: [{ id: "sell", pri: 3, ai(g, u) {
    const p = g.p[u.ctrl], gold = Math.max(0, p.gold - goldReserve(g, p)), spl = u.stolen ? 0 : spliceCount(u);
    let best = null;
    for (const t of units(p)) {
      if (t.stolen) continue;
      const want = radiant(t) && wantsAtk(g, t) ? gold + 3 * spl : Math.ceil(Math.max(0, t.maxHp - t.hp) / 2);
      for (let k = 0; k <= spl; k++) {   // k splices banished, each counts as 3 gold
        const x = Math.min(want, gold + 3 * k), g2 = Math.max(0, x - 3 * k); if (!x) continue;
        const s = healWorth(g, t, 2 * x) - g2 * goldW(g, p) * 0.5 - k * spliceCost(u);
        if (!best || s > best.s) best = { t, x, g2, k, s };
      }
    }
    return best && best.s > 0.3 ? { score: best.s, run: () => {
      for (let k = 0; k < best.k; k++) banishSplice(g, u);
      p.gold -= best.g2; restoreHP(g, p, best.t, 2 * best.x);
    } } : null;
  } }] },
};

// ---- Plushy faction: plush versions reuse their originals' effects ----
const clawPick = c => isClaw(c) ? 1 : null;
const fluffyWaste = p => p.waste.filter(c => fluffy(c) && isUnitKind(c.d.kind) && !p.lazarus.includes(c));
const hasPatchwork = p => p.hand.concat(units(p).map(u => u.c)).some(c => c.d.fx && c.d.fx.patchwork);
Object.assign(FX, {
  "Arcade Kid": { value: 1.5, onPlay(g, u) { const p = g.p[u.ctrl]; if (!p.hand.some(isClaw)) tutor(g, p, clawPick); } },
  "Plush Collector": { value: 3, acts: [{ id: "search", pri: 0, ai(g, u) {
    const p = g.p[u.ctrl]; if (u.stolen || !p.deck.some(isClaw)) return null;
    const inHand = p.hand.some(isClaw), s = !hasClaw(p) && !inHand ? 3 : inHand ? 0.2 : 0.9;   // a spare one against Pipebomb
    return { score: s, run: () => tutor(g, p, clawPick) };
  } }] },
  "Plush Cherub": { value: 1.5, fluffyDraw: true, onPlay(g, u) { if (says(u.d, /when materialized: restore/i)) FX["Cherub"].onPlay(g, u); } }, "Plush Blood Imp": FX["Blood Imp"], "Plush Sanctified Knight": FX["Sanctified Knight"],
  "Plush Judicator Angel": FX["Judicator Angel"], "Plush Vein Ripper": {},
  "Plush Goblin": { value: 1, onPlay(g, u) { gainGold(g, g.p[u.ctrl], 1); } },
  "Plush Dark Duchess": { value: 3, endTurn(g, u) {   // a Fluffy creature from the Waste Repository back to the hand
    const p = g.p[u.ctrl], list = fluffyWaste(p).filter(c => c.d.kind === "creature");
    if (!list.length || (hasPatchwork(p) && list.length < 3)) return;   // Patchwork Plush wants them in the Waste Repository
    const c = list.sort((a, b) => defValue(b.d) - defValue(a.d))[0];
    p.waste.splice(p.waste.indexOf(c), 1); p.hand.push(c); L(g, `  Plush Dark Duchess returns ${c.d.name} to the hand.`);
  } },
  "Patchwork Plush": { value: 2, patchwork: true, aura(g, k, u) { return k === u ? g.p[u.ctrl].waste.filter(fluffy).length : 0; } },
  "Mega Plush": { value: 4, perSplice: 1, clawGuard: true, aura(g, k, u) { return k !== u && fluffy(u) ? spliceCount(k) : 0; } },
});

// one-shot spells: play(g, p, card) returns { pri, score, run } or null. pri: 0 setup, 1 removal, 2 creatures (the plan), 3 after
const SPELLS = {
  "Ritual Pit": { perm: true, pit: true, needs: x => x.fusions > 0 && x.pitTargets > 0, score: (g, p) => p.fdeck.length ? 2.2 : 0.6 },
  "Bull Run": { perm: true, goldBonus: true, wantsGold5: true, score: () => 2.5,
    aura: (g, p, u) => hasAttr(u.d, "greedy") && p.gold >= num(spellsOf(p).find(z => z.c.d.fx && z.c.d.fx.goldBonus).c.d, /while you have (\d+) or more gold/i, 5) ? 1 : 0 },
  "Goblin Bank": { perm: true, startTurn(g, p) { if (p.gold < 5) gainGold(g, p, 1); }, score: () => 2.5 },
  "Sanctuary Bells": { perm: true, bells: true, score: (g, p) => 2.5 + (p.hand.some(descendOf) ? 0.5 : 0),   // follows its text, old and new wordings
    startTurn(g, p, z) { if (says(z.c.d, /start of your turn: restore 1 HP to each of your 'Holy'/i)) units(p).forEach(u => { if (hasAttr(u.d, "holy")) restoreHP(g, p, u, 1); }); },
    endEachTurn(g, q) {
      const d = q.field.c.d;
      if (says(d, /each player restores 1 PHP/i)) g.p.forEach(x => restorePHP(g, x, 1));
      if (says(d, /'holy' creature on the field/i) && (says(d, /end of each turn/i) || g.active === q.i))
        g.p.forEach(x => units(x).forEach(u => { if (hasAttr(u.d, "holy")) restoreHP(g, q, u, 1); }));
    } },
  "Crimson Altar": { perm: true, altar: true, needs: x => x.fusions > 0 && x.unholy >= 4, score: (g, p) => p.fdeck.length ? 2 : 0.5,
    acts: [{ id: "feed", pri: 3, ai(g, p, z) {   // only if its text has "sacrifice ... to draw N cards"
      const n = num(z.c.d, /sacrifice[^.]*to draw (\d+) card/i, 0); if (!n) return null;
      let best = null;
      for (const u of units(p)) if (hasAttr(u.d, "unholy")) { const s = n * 2.2 + sacrificeBonus(g, p) - keepWorth(g, u) + (fxOf(u) && fxOf(u).deathPenalty ? 1.5 : 0); if (!best || s > best.s) best = { u, s }; }
      return best && best.s > 0.5 ? { score: best.s, run: () => { sacrifice(g, p, best.u); if (!g.over) draw(g, p, n); } } : null;
    } }] },
  "Divine Shelter": { shelter: true },
  "Loaded Dice": { loaded: true, needs: x => x.dice >= 4 },
  "It's Free Fuse-Estate": { estate: true, needs: x => x.fusions > 0 },
  // v4.7 audit: back from cold storage
  "Thiefling Sleight of Hand": { steal: true },   // see countered(): the spell does nothing and goes into your deck
  "Nuclear Waste": { perm: true, score: (g, p) => 1.2 + (units(p).length ? units(p).reduce((s, u) => s + 1.5 - valueOf(g, u) / 6, 0) / units(p).length : 0),
    endTurn(g, p) {   // a d6 for a random creature you control: 1 destroy it, 4-6 +2 ATK and +2 HP permanently
      const us = units(p); if (!us.length) return;
      const u = us[Math.floor(g.dice() * us.length)]; let r = 1 + Math.floor(g.dice() * 6);
      if (r === 1 && valueOf(g, u) > 4 && useLoadedDice(g, p)) { r = 1 + Math.floor(g.dice() * 6); L(g, `  Loaded Dice: Nuclear Waste rolls again.`); }
      L(g, `  Nuclear Waste rolls ${r} for ${u.d.name}.`);
      if (r === 1) kill(g, u, {});
      else if (r >= 4) { u.pAtk += 2; u.maxHp += 2; u.hp += 2; L(g, `  ${u.d.name} gains +2 ATK and +2 HP.`); }
    } },
  "Crack a pack": { play(g, p, c) {   // the top 5 cards: 1 into the hand, the rest into the Waste Repository
    const n = num(c.d, /top (\d+) cards/i, 5); if (p.deck.length < n + 6) return null;
    const dig = p.hand.concat(units(p).map(u => u.c)).some(x => fossilOf(x.d) != null || (x.d.fx && x.d.fx.bpWaste)) ? 0.8 : 0;
    const s = 2.6 + dig - (p.deck.length < 16 ? 1 : 0);
    return { pri: 0, score: s, run: () => cast(g, p, c, () => {
      const top = p.deck.splice(-Math.min(n, p.deck.length)); if (!top.length) return;
      const keep = top.slice().sort((a, b) => keepValue(g, p, b) - keepValue(g, p, a))[0];
      p.hand.push(keep); top.filter(x => x !== keep).forEach(x => toWaste(g, x));
      L(g, `  Crack a pack: ${who(g, p)} keeps ${keep.d.name}; ${top.length - 1} cards go to the Waste Repository.`);
    }) };
  } },
  "Jar of Materialism": { play(g, p, c) {
    const cost = num(c.d, /pay (\d+) PHP/i, 0), n = num(c.d, /draw (\d+) cards/i, 2);
    if (!drawOk(p, n) || (cost && !canPay(p, cost))) return null;
    const s = 2.5 * n - cost * phpW(g, p);
    return s > 0.4 ? { pri: 0, score: s, run: () => cast(g, p, c, () => { if (cost) payPHP(g, p, cost); if (!g.over) draw(g, p, n); }) } : null;
  } },
  "Energy Drink": { play(g, p, c) {
    const t = bestHeal(g, p, u => Math.floor(u.maxHp / 2));
    const sp = num(c.d, /\+(\d+) Speed/i, 0);
    return t && t.s > 1.2 ? { pri: 3, score: t.s - 0.8 + sp * 0.15, run: () => cast(g, p, c, () => { restoreHP(g, p, t.u, t.n); if (sp && onField(g, t.u)) t.u.tSpd += sp; }) } : null;
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
    const sp = num(c.d, /\+(\d+) Speed/i, 1);
    return best && best.s > 0.5 ? { pri: 3, score: best.s, run: () => cast(g, p, c, () => { best.u.tAtk += 4; best.u.tSpd += sp; best.u.frenzy = true; L(g, `  ${best.u.d.name} gets +4 ATK and +${sp} Speed.`); }) } : null;
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
  "Market Research": { goldCost: 4, goldSink: true, play(g, p, c) {
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
      best.q.waste.splice(i, 1); materialize(g, p, best.x, chooseLane(g, p, best.x.d), "waste");
    }) };
  } },
  "Pipebomb": { pipebomb: true, play(g, p, c) {   // v4.7: destroy a spell as it's played (see countered) or one that's in play, right away
    const any = says(c.d, /spell card, destroy it/i), o = foe(g, p), ts = spellsOf(o).filter(z => !z.bomb && (any || !z.watch));
    if (!ts.length) return null;
    const z = ts.find(x => x === o.field && isClaw(x.c)) || ts.find(x => x === o.field) || ts[0];
    const now = any || says(c.d, /destroy a continuous spell or field spell/i), s = (isClaw(z.c) && units(o).some(fluffy) ? 5 : 2.5) - (now ? 0.8 : 0);
    return { pri: 1, score: s, run: () => cast(g, p, c, () => {
      if (now) { if (spellsOf(o).includes(z)) removeSpell(g, o, z, "Pipebomb"); }
      else { z.bomb = { by: p.i }; L(g, `  Pipebomb is placed on ${z.c.d.name}.`); }
    }) };
  } },
  "Space Squid": { play(g, p, c) {
    if (g.phase !== 1 || g.turnNo === 1 || !emptyLanes(p).length) return null;
    const o = foe(g, p), paid = says(c.d, /pay PHP equal to/i), until = says(c.d, /start of your next turn/i) ? "start" : "end";
    const cost = t => paid ? (t.d.kind === "fusion" ? num(c.d, /(\d+) for a fusion/i, 10) : t.d.flux || 0) : 0;
    const outlet = units(p).some(u => fxOf(u) && fxOf(u).bpWaste && !p.once.has(u.d.name + ":eat")) || p.hand.some(x => x.d.name === "Blood Frenzy");
    let best = null;
    for (const t of units(o)) {
      const k = cost(t); if (k && !canPay(p, k)) continue;
      let s = valueOf(g, t) * (outlet ? 1.1 : until === "start" ? 0.6 : 0.35) - k * phpW(g, p);
      for (const u of units(p)) if (u.lane === t.lane && !u.attacked) s += expAtk(g, u) * 0.4;
      if (!best || s > best.s) best = { t, s, k };
    }
    if (!best || best.s - 1.5 <= 0.5) return null;
    return { pri: best.s >= 8 ? 1 : 3, score: best.s - 1.5, run: () => cast(g, p, c, () => {
      if (best.k) { L(g, `  ${who(g, p)} pays ${best.k} PHP for Space Squid.`); payPHP(g, p, best.k); if (g.over) return; }
      steal(g, p, best.t, until);
    }) };
  } },
  "Unfuse": { play(g, p, c) {
    let best = null;
    for (const t of units(foe(g, p))) if (t.d.kind === "fusion" && t.splices.length) {
      const s = valueOf(g, t) - t.splices.reduce((a, x) => a + defValue(x.d), 0) * 0.8 + 0.2;
      if (!best || s > best.s) best = { t, s };
    }
    return best && best.s > 1 ? { pri: 1, score: best.s, run: () => cast(g, p, c, () => unfuse(g, p, best.t)) } : null;
  } },
  "Overclock": { play(g, p, c) {   // feed the reactor: the least useful card on your field (older wording: in your hand) to Oblivion for N flux this turn
    if (g.phase !== 1) return null;
    const n = num(c.d, /gain (\d+) flux/i, 2), keep = p.hand.slice();
    const gain = take => {   // how much better this turn's plan gets with the card gone and N more flux
      p.hand = keep.filter(x => x !== c); const before = bestPlan(g, p).score, undo = take(); p.flux += n;
      const after = bestPlan(g, p).score; p.flux -= n; undo(); p.hand = keep; return after - before;
    };
    let best = null;
    const consider = (worth, take, feed) => { const s = gain(take) - worth - 0.5; if (!best || s > best.s) best = { s, feed }; };
    if (says(c.d, /from your field/i)) {
      for (const u of units(p)) consider(keepWorth(g, u), () => { p.lanes[u.lane] = null; return () => { p.lanes[u.lane] = u; }; }, () => banishUnit(g, u));
      for (const z of spellsOf(p)) consider(z.c.d.fx && z.c.d.fx.score ? z.c.d.fx.score(g, p) : 2,
        () => { const f = p.field === z, i = p.zones.indexOf(z); if (f) p.field = null; else p.zones.splice(i, 1); return () => { if (f) p.field = z; else p.zones.splice(i, 0, z); }; },
        () => { if (p.field === z) p.field = null; else p.zones.splice(p.zones.indexOf(z), 1); g.p[z.c.owner].oblivion.push(z.c); L(g, `  ${z.c.d.name} is banished.`); });
    } else for (const x of keep) if (x !== c) consider(holdWorth(x),
      () => { const i = keep.indexOf(x); keep.splice(i, 1); return () => keep.splice(i, 0, x); },
      () => { const j = p.hand.indexOf(x); if (j >= 0) { p.hand.splice(j, 1); g.p[x.owner].oblivion.push(x); } });
    return best && best.s > 0.5 ? { pri: 1, score: best.s, run: () => cast(g, p, c, () => { best.feed(); p.flux += n; L(g, `  Overclock feeds the reactor: +${n} flux.`); }) } : null;
  } },
  "Blood Ledger": { perm: true, score: () => 2.5, acts: [{ id: "draw", pri: 0, ai(g, p, z) {   // once per turn: pay PHP to search for an Unholy creature
    const cost = num(z.c.d, /pay (\d+) PHP/i, 2);
    if (!canPay(p, cost) || p.hand.length >= R.handLimit - 1) return null;
    if (!says(z.c.d, /search your deck/i)) {   // older text: pay PHP to draw
      const n = num(z.c.d, /to draw (\d+) card/i, 1); if (p.deck.length < n) return null;
      const worth = p.hand.length <= 1 ? 3.5 : p.hand.length <= 3 ? 2.5 : p.hand.length < R.handLimit - 1 ? 1.5 : 0;
      return { score: worth * n - cost * phpW(g, p), run: () => { L(g, `${who(g, p)} pays ${cost} PHP to draw (Blood Ledger).`); payPHP(g, p, cost); if (!g.over) draw(g, p, n); } };
    }
    const pick = x => x.d.kind === "creature" && hasAttr(x.d, "unholy") ? defValue(x.d) * ((x.d.flux || 0) <= p.maxFlux + 1 ? 1 : 0.4) : null;
    const pool = p.deck.filter(x => pick(x) != null); if (!pool.length) return null;
    const cre = p.hand.filter(x => isUnitKind(x.d.kind)).length, best = Math.max(...pool.map(pick));
    const worth = (cre === 0 ? 3.8 : cre <= 2 ? 2.6 : 1.4) + best * 0.04;
    return { score: worth - cost * phpW(g, p), run: () => { L(g, `${who(g, p)} pays ${cost} PHP (Blood Ledger).`); payPHP(g, p, cost); if (!g.over) tutor(g, p, pick); } };
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
  // ---- v4.5 ----
  "Boss's Orders": { play(g, p, c) {   // move a creature (either side) to an empty lane on its controller's side
    if (g.phase !== 1) return null;
    const mine = () => units(p).reduce((s, u) => s + Math.max(0, bestAttack(g, u)), 0) + Math.max(0, (bestPlan(g, p) || { score: 0 }).score);
    const base = mine(); let best = null;
    for (const u of allUnits(g)) {
      const q = g.p[u.ctrl], from = u.lane;
      for (const l of emptyLanes(q)) {
        q.lanes[from] = null; q.lanes[l] = u; u.lane = l;
        const s = mine() - base;
        q.lanes[l] = null; q.lanes[from] = u; u.lane = from;
        if (!best || s > best.s) best = { u, l, s };
      }
    }
    return best && best.s - 1 > 0.5 ? { pri: 1, score: best.s - 1, run: () => cast(g, p, c, () => {
      const u = best.u, q = g.p[u.ctrl]; if (!onField(g, u) || q.lanes[best.l]) return;
      L(g, `  ${u.d.name} moves from the ${LANE[u.lane]} lane to the ${LANE[best.l]} lane.`);
      q.lanes[u.lane] = null; q.lanes[best.l] = u; u.lane = best.l;
    }) } : null;
  } },
  "Melting Pot": { perm: true, pot: true, needs: x => x.fusions > 0, score: (g, p) => fieldFx(g, "pot") ? 0 : p.fdeck.length ? 2.3 : 0.4 },
  "Twisted Dimensions": { perm: true, trick: true, score: (g, p) => {   // worth it when your creatures are slower than theirs
    if (fieldFx(g, "trick")) return 0;
    const avg = q => { const us = units(q); return us.length ? us.reduce((s, u) => s + speedOf(u), 0) / us.length : 2; };
    return 1 + (avg(foe(g, p)) - avg(p)) * 1.5;
  } },
  "Shotgun Wedding": { wedding: true, needs: x => x.fusions > 0 },   // used by fusionOpts
  // ---- Plushy ----
  "Claw Machine": { perm: true, claw: true, core: cre => cre.some(d => d.attrs.includes("fluffy")),
    score: (g, p) => hasClaw(p) ? 0 : units(p).some(fluffy) || p.hand.some(fluffy) ? 6 : 1.2 },
  "Plush Catalogue": { play(g, p, c) {   // any card with "Plush" in its name
    const pick = x => {
      if (!/plush/i.test(x.d.name)) return null;
      if (x.d.name === "Plush Collector") return !hasClaw(p) && !p.hand.some(isClaw) && !units(p).some(u => u.d.name === x.d.name) ? 9 : 1;
      if (x.d.kind !== "creature") return 0.5;
      const f = Math.max(0, x.d.flux - (x.d.fx && x.d.fx.patchwork ? p.waste.filter(fluffy).length : 0));
      return defValue(x.d) - (f > p.maxFlux + 1 ? 4 : 0);
    };
    let best = null; for (const x of p.deck) { const s = pick(x); if (s != null && (best == null || s > best)) best = s; }
    return best == null ? null : { pri: 0, score: 1 + best * 0.25, run: () => cast(g, p, c, () => tutor(g, p, pick)) };
  } },
  "Needle and Thread": { play(g, p, c) {   // up to 2 Fluffy creatures from the Waste Repository back to the hand
    const list = fluffyWaste(p).filter(x => x.d.kind === "creature").sort((a, b) => defValue(b.d) - defValue(a.d)).slice(0, 2);
    if (!list.length) return null;
    const s = list.reduce((a, x) => a + defValue(x.d) * 0.3, 0) - (hasPatchwork(p) ? list.length * 1.2 : 0);
    return s > 0.5 ? { pri: 3, score: s, run: () => cast(g, p, c, () => {
      list.forEach(x => { const i = p.waste.indexOf(x); if (i >= 0) { p.waste.splice(i, 1); p.hand.push(x); } });
      L(g, `  ${who(g, p)} returns ${list.map(x => x.d.name).join(" and ")} to the hand.`);
    }) } : null;
  } },
};

// Dinos (v4.6)
Object.assign(FX, {
  "Compsognathus": { value: 0.8, onDeath(g, u) { mill(g, g.p[u.ctrl], num(u.d, /top (\d+) cards/i, 2)); } },
  "Velociraptor": { value: 1, onAttack(g, u, t) {   // 1 damage to a creature next to its target
    if (!t || !onField(g, t)) return; const o = g.p[t.ctrl], ns = NB[t.lane].map(l => o.lanes[l]).filter(Boolean);
    if (ns.length) damage(g, ns.sort((a, b) => a.hp - b.hp)[0], num(u.d, /deal (\d+) damage to a creature in a lane next/i, 1), {});
  } },
  "Dilophosaurus": { value: 1.5, onPlay(g, u) { const t = foe(g, g.p[u.ctrl]).lanes[u.lane]; if (t) damage(g, t, num(u.d, /deal (\d+) damage to the enemy creature in front/i, 2), {}); } },
  "Ankylosaurus": { value: 1.5, reduceFirst: 2 },
  "Triceratops": { value: 1.5 },
  "Pteranodon": { value: 1.5, onRaise(g, u) {   // dug up: another Prehistoric creature from the Waste Repository to your hand
    const p = g.p[u.ctrl], list = p.waste.filter(c => prehistoric(c) && !p.lazarus.includes(c));
    if (!list.length) return; const c = list.sort((a, b) => defValue(b.d) - defValue(a.d))[0];
    p.waste.splice(p.waste.indexOf(c), 1); p.hand.push(c); L(g, `  Pteranodon returns ${c.d.name} to the hand.`);
  } },
  "Brontosaurus": { value: 1.5 },
  "T-Rex": { value: 2, onRaise(g, u) { const t = foe(g, g.p[u.ctrl]).lanes[u.lane]; if (t) damage(g, t, num(u.d, /deal (\d+) damage to the enemy creature in front/i, 3), {}); } },
  "TT-rex": { value: 4, perSplice: 1, acts: [{ id: "raise", pri: 2, ai(g, u) {   // banish a splice: a Prehistoric creature back for free
    const p = g.p[u.ctrl]; if (g.phase !== 1 || u.stolen || !spliceCount(u) || !emptyLanes(p).length) return null;
    const b = bestFossil(g, p, true); if (!b) return null;
    const s = defValue(b.c.d) * 0.8 - spliceCost(u);
    return s > 1 ? { score: s, run: () => { if (banishSplice(g, u)) fossilRaise(g, p, b.c, 0); } } : null;
  } }] },
  "Necrosaurus": { value: 2, aura(g, k, u) { return k === u ? g.p[u.ctrl].waste.filter(prehistoric).length : 0; } },
  // v4.7: cross-faction fusions with attribute recipes
  "Chimera": { value: 1, perSplice: 1, aura(g, k, u) { return k === u ? spliceCount(u) : 0; } },   // any 2 Beasts, any flux cost
  "Absolute Unit": { value: 1, perSplice: 1, aura(g, k, u) { return k === u ? spliceCount(u) : 0; } },   // any 2 Heavy fusions
  "Blood Mage": { value: 2.5, perSplice: 0.6, onSpell(g, u) {   // pay 1 PHP: 1 damage per fusion splice to an enemy creature
    const p = g.p[u.ctrl], n = spliceCount(u); if (!n || !canPay(p, 1)) return;
    let best = null; for (const t of units(foe(g, p))) { const s = damageWorth(g, p, t, n); if (!best || s > best.s) best = { t, s }; }
    if (!best || best.s <= phpW(g, p) + 0.3) return;
    L(g, `  Blood Mage: ${who(g, p)} pays 1 PHP.`); payPHP(g, p, 1); if (!g.over && onField(g, best.t)) damage(g, best.t, n, {});
  } },
  "The Flock": { value: 2, perSplice: 0.8, onAttack(g, u) {   // 1 damage to the opponent per fusion splice
    const p = g.p[u.ctrl], o = foe(g, p), n = spliceCount(u); if (!n) return;
    L(g, `  The Flock: ${n} damage to ${who(g, o)}.`); p.st.face += n; losePHP(g, o, n);
  } },
  "Fossil Fuel Baron": { value: 2, goldSink: true, acts: [investAct(1)], onWasteBanish(g, u, n) {   // 1 gold per card banished from your Waste Repository
    L(g, `  Fossil Fuel Baron: +${n} gold.`); gainGold(g, g.p[u.ctrl], n);
  } },
});
Object.assign(SPELLS, {
  "Archaeologist": { needs: x => (x.dino || 0) >= 6, play(g, p, c) {   // mill 4, then dig one up for its Fossil cost
    if (g.phase !== 1) return null;
    const n = num(c.d, /top (\d+) cards/i, 4); if (p.deck.length < n + 4) return null;
    const s = 1.5 + (emptyLanes(p).length ? 2 : 0) + Math.min(2, p.waste.filter(prehistoric).length * 0.5);
    return { pri: 2, score: s, run: () => cast(g, p, c, () => {
      mill(g, p, n); if (!emptyLanes(p).length) return;
      const b = bestFossil(g, p, false); if (b && b.s > 0) fossilRaise(g, p, b.c, b.x);
    }) };
  } },
  "Fossil Record": { needs: x => (x.dino || 0) >= 6, play(g, p, c) {   // up to 2 Prehistoric creatures back to the hand
    const k = num(c.d, /up to (\d+) 'Prehistoric'/i, 2), list = p.waste.filter(x => prehistoric(x) && !p.lazarus.includes(x)).sort((a, b) => defValue(b.d) - defValue(a.d)).slice(0, k);
    if (!list.length) return null;
    const s = list.reduce((a, x) => a + defValue(x.d) * 0.3, 0) - 1;
    return s > 0.5 ? { pri: 3, score: s, run: () => cast(g, p, c, () => { list.forEach(x => { const i = p.waste.indexOf(x); if (i >= 0) { p.waste.splice(i, 1); p.hand.push(x); } }); L(g, `  ${list.map(x => x.d.name).join(" and ")} go back to the hand.`); }) } : null;
  } },
  "Primordial Soup": { perm: true, needs: x => (x.dino || 0) >= 6, score: (g, p) => p.deck.length > 10 ? 2.2 : 0.4,
    endTurn(g, p) { mill(g, p, 1); },
    startTurn(g, p) {   // d20: on a 1 every creature on the field is destroyed
      const r = 1 + Math.floor(g.dice() * 20); if (r !== 1) return;
      L(g, `  Primordial Soup rolls a 1: every creature on the field is destroyed.`);
      for (const u of allUnits(g)) { if (onField(g, u)) destroy(g, u, {}); if (g.over) return; }
    } },
});


// v4.7: Mundane (Complaints), Wizards (Spellcount)
const ordinary = u => hasAttr(u.d, "ordinary");
const complainAct = { id: "complain", pri: 1, ai(g, u) {
  const p = g.p[u.ctrl], t = bestComplaint(g, p);
  return t && t.s > 0.5 ? { score: t.s, run: () => complain(g, t.u) } : null;
} };
Object.assign(FX, {
  "Cat": { value: 1, endTurn(g, u) { if (u.attacked) return; const t = bestComplaint(g, g.p[u.ctrl]); if (t) complain(g, t.u); } },
  "Gregg": {},
  "Gregg's Friend Joe": { value: 1, onAttack(g, u, t) { if (t && onField(g, t)) complain(g, t); } },
  "Johnny '5 inches'": { value: 1, onFine(g, u) { const p = g.p[u.ctrl]; L(g, `  Johnny: +1 PHP and +1 gold.`); gainPHP(g, p, 1); gainGold(g, p, 1); } },
  "Gregg's Dawg": { value: 2, guardOrdinary: 1 },
  "Nosy Neighbor": { value: 2, onPlay(g, u) {
    const p = g.p[u.ctrl], a = bestComplaint(g, p); if (!a) return; complain(g, a.u);
    const b = bestComplaint(g, p, [a.u]); if (b) complain(g, b.u);
  } },
  "Mall Cop Gary": { value: 3, copLock: true, acts: [complainAct] },
  "The Local Legend": { value: 3, perSplice: 1, acts: [{ id: "rally", pri: 1, ai(g, u) {
    const p = g.p[u.ctrl]; if (!spliceCount(u) || u.stolen) return null;
    const s = units(foe(g, p)).reduce((a, x) => a + complaintWorth(g, p, x), 0) - spliceCost(u) - 0.5;
    return s > 0.5 ? { score: s, run: () => { if (banishSplice(g, u)) units(foe(g, p)).forEach(x => complain(g, x)); } } : null;
  } }] },
  "HOA President": { value: 4, perSplice: 1, fineUp: true, acts: [{ id: "rule", pri: 1, ai(g, u) {
    const p = g.p[u.ctrl], ord = units(p).filter(ordinary), opts = [];
    const t = bestComplaint(g, p); if (t) opts.push({ s: t.s, run: () => complain(g, t.u) });
    if (g.phase === 1) {
      let gain = 0;
      for (const k of ord) { if (k.attacked) continue; const b = Math.max(0, bestAttack(g, k)); k.tAtk += 2; gain += Math.max(0, bestAttack(g, k)) - b; k.tAtk -= 2; }
      opts.push({ s: gain, run: () => { ord.forEach(k => { k.tAtk += 2; }); L(g, `  HOA President: Ordinary creatures get +2 ATK.`); } });
    }
    opts.push({ s: ord.reduce((s, k) => s + healWorth(g, k, 3), 0), run: () => ord.forEach(k => restoreHP(g, p, k, 3)) });
    const b = opts.sort((x, y) => y.s - x.s)[0];
    return b && b.s > 0.5 ? { score: b.s, run: b.run } : null;
  } }] },
  "Purrramid": { value: 3, endTurn(g, u) { if (!u.attacked) restoreHP(g, g.p[u.ctrl], u, num(u.d, /restore (\d+) HP to it/i, 3)); } },
  // Wizards
  "Apprentice": { value: 1.5, onSpell(g, u) { u.tAtk += 1; } },
  "Toad Familiar": { value: 1.5, onDeath(g, u) { spellBack(g, g.p[u.ctrl]); } },
  "Mail-Order Wizard": { value: 1, onPlay(g, u) { const p = g.p[u.ctrl]; draw(g, p, 1); discardWorst(g, p); } },
  "Spell Slinger": { value: 1.5, onSpell(g, u) {
    const p = g.p[u.ctrl], face = num(u.d, /whenever you play a spell: deal (\d+) damage to your opponent/i, 0);
    if (face) { L(g, `  Spell Slinger deals ${face} damage to ${who(g, foe(g, p))}.`); p.st.face += face; losePHP(g, foe(g, p), face); return; }
    if (p.sc !== 3) return;
    let best = null; for (const t of units(foe(g, p))) { const s = damageWorth(g, p, t, 3); if (!best || s > best.s) best = { t, s }; }
    if (best) { L(g, `  Spell Slinger deals 3 damage to ${best.t.d.name}.`); damage(g, best.t, 3, {}); }
  } },
  "Night School Professor": { value: 1.5, acts: [{ id: "class", pri: 0, ai(g, u) {
    const p = g.p[u.ctrl], spells = p.waste.filter(oneShot); if (!spells.length || p.waste.length < 3) return null;
    return { score: 2, run: () => {
      const keep = spells.sort((a, b) => holdWorth(b) - holdWorth(a))[0];
      const fuel = p.waste.filter(c => c !== keep && !p.lazarus.includes(c)).sort((a, b) => (oneShot(a) ? 1 : 0) - (oneShot(b) ? 1 : 0) || defValue(a.d) - defValue(b.d)).slice(0, 2);
      if (fuel.length < 2) return; banishFromWaste(g, p, fuel); spellBack(g, p, c => c === keep);
    } };
  } }] },
  "Head Librarian": { value: 2.5, onSpell(g, u) { const p = g.p[u.ctrl], k = "Head Librarian:" + u.uid; if (p.once.has(k) || !drawOk(p, 1)) return; p.once.add(k); L(g, `  Head Librarian: ${who(g, p)} draws a card.`); draw(g, p, 1); } },
  "Battlemage": { value: 1.5, aura(g, k, u) { return k === u ? g.p[u.ctrl].sc || 0 : 0; } },
  "The Archmage": { value: 3, twice: true },
  "Wizard Tower": { value: 3, perSplice: 0.5, acts: [{ id: "tower", pri: 0, free: true, ai(g, u) {   // banish a splice: a one-shot spell back
    const p = g.p[u.ctrl]; if (!spliceCount(u) || u.stolen || p.hand.length >= R.handLimit - 1) return null;
    const spells = p.waste.filter(c => oneShot(c) && !p.lazarus.includes(c)); if (!spells.length) return null;
    const keep = spells.sort((a, b) => holdWorth(b) - holdWorth(a))[0];
    const s = holdWorth(keep) + (p.hand.some(oneShot) ? 0 : 0.6) - spliceCost(u) * 0.8;
    return s > 0.6 ? { score: s, run: () => { if (banishSplice(g, u)) spellBack(g, p, c => c === keep); } } : null;
  } }] },
  "Spellsword": { value: 2, onSpell(g, u) { u.tAtk += 2; } },
});
Object.assign(SPELLS, {
  // Mundane
  "HOA Complaint": { play(g, p, c) {
    const t = bestComplaint(g, p); if (!t) return null;
    const s = t.s + (t.u.complaints && fxOf(t.u) ? (fxOf(t.u).value || 1) * 0.6 : 0) - 0.6;
    return s > 0.5 ? { pri: 1, score: s, run: () => cast(g, p, c, () => {
      if (!onField(g, t.u)) return;
      if (t.u.complaints) { t.u.negated = true; L(g, `  ${t.u.d.name} loses its effects until end of turn.`); }
      complain(g, t.u);
    }) } : null;
  } },
  "Tax Evasion": { tax: true },
  "Costco Hot Dog and Soda Comb for $1.5": { play(g, p, c) {
    let best = null; for (const u of units(p)) if (ordinary(u) && !u.stolen) { const s = healWorth(g, u, 4); if (!best || s > best.s) best = { u, s }; }
    const s = (best ? best.s : 0) + 2 - 0.4;
    return { pri: 3, score: s, run: () => cast(g, p, c, () => { if (best) restoreHP(g, p, best.u, 4); draw(g, p, 1); }) };
  } },
  "The bodega": { perm: true, score: () => 2.2, endTurn(g, p) {
    if (!drawOk(p, 1) || !p.hand.length) return;
    const ordC = c => c.d.kind === "creature" && hasAttr(c.d, "ordinary"), keep = c => isUnitKind(c.d.kind) ? 3 + defValue(c.d) * 0.1 - (ordC(c) ? 0.6 : 0) : 3.5;
    const c = p.hand.slice().sort((a, b) => keep(a) - keep(b))[0], ord = ordC(c);
    if (keep(c) >= 3.6) return;
    L(g, `  The bodega:`); p.hand.splice(p.hand.indexOf(c), 1); toWaste(g, c); L(g, `  ${who(g, p)} swaps ${c.d.name} for a new card.`); draw(g, p, 1);
    if (ord) { const t = bestComplaint(g, p); if (t) complain(g, t.u); }
  } },
  "Greggs": { perm: true, score: (g, p) => 1 + [...units(p).map(u => u.c), ...p.hand].filter(c => /gregg/i.test(c.d.name) && isUnitKind(c.d.kind)).length * 0.4,
    endEachTurn(g, q) { for (const u of allUnits(g)) if (/gregg/i.test(u.d.name)) restoreHP(g, g.p[u.ctrl], u, 1); } },
  "Gregg's Vape": { play(g, p, c) {
    if (g.phase !== 1 || g.turnNo === 1) return null;
    let best = null;
    for (const u of units(p)) {
      if (!/gregg/i.test(u.d.name) || u.attacked || u.stolen) continue;
      const b = Math.max(0, bestAttack(g, u)); u.tAtk += 4; const s = Math.max(0, bestAttack(g, u)) - b - 1.2; u.tAtk -= 4;
      if (!best || s > best.s) best = { u, s };
    }
    return best && best.s > 0.5 ? { pri: 3, score: best.s, run: () => cast(g, p, c, () => { if (!onField(g, best.u)) return; best.u.tAtk += 4; best.u.vape = true; L(g, `  ${best.u.d.name} gets +4 ATK.`); }) } : null;
  } },
  "Neighborhood Watch": { play(g, p, c) {   // a Spell that stays in its spell zone for the opponent's next 2 turns
    const o = foe(g, p), bad = units(o).filter(u => u.complaints).length, makers = units(p).filter(u => fxOf(u) && (fxOf(u).copLock || fxOf(u).acts || u.d.name === "Cat")).length;
    const s = 0.8 + bad * 1.2 + makers * 0.4;
    return s > 1.5 ? { pri: 3, score: s, run: () => {
      const i = p.hand.indexOf(c); if (i < 0) return; p.hand.splice(i, 1); if (c.owner === p.i) p.st.played.add(c.d.ix);
      L(g, `${who(g, p)} casts ${c.d.name}.`); spellPlayed(g, p, c);
      if (g.over || countered(g, p, c)) { toWaste(g, c); return; }
      p.zones.push({ c, watch: 2 });
    } } : null;
  } },
  // Wizards
  "Abracadabra": { play(g, p, c) {   // only at Spellcount 3+: a creature that isn't a fusion goes back to its owner's hand
    if (!scOk(p, c)) return null;
    const ts = bounceTargets(g, p); if (!ts.length) return null;
    const s = ts[0].s - 0.6;
    return s > 0.5 ? { pri: 1, score: s, run: () => cast(g, p, c, () => { const t = bounceTargets(g, p)[0]; if (t) bounce(g, t.t); }) } : null;
  } },
  "Card Trick": { play(g, p, c) {   // take a card from the opponent's hand: into their deck, or (Spellcount 3+) their Waste Repository
    const o = foe(g, p); if (!o.hand.length) return null;
    const big = (p.sc || 0) + 1 >= 3, others = p.hand.filter(x => x !== c && oneShot(x)).length;
    const s = 1 + Math.min(1.2, o.hand.length * 0.3) + (big ? 1.8 : 0) - (!big && others >= 2 - (p.sc || 0) ? 0.8 : 0);
    const worth = x => isUnitKind(x.d.kind) ? defValue(x.d) * ((x.d.flux || 0) <= o.maxFlux + 1 ? 0.5 : 0.25) : 4;
    return s > 0.5 ? { pri: 1, score: s, run: () => cast(g, p, c, () => {
      if (!o.hand.length) return;
      const x = o.hand.slice().sort((a, b) => worth(b) - worth(a))[0];
      o.hand.splice(o.hand.indexOf(x), 1);
      if ((p.sc || 0) >= 3) { toWaste(g, x); L(g, `  Card Trick: ${x.d.name} goes to ${who(g, o)}'s Waste Repository.`); }
      else { o.deck.splice(Math.floor(g.dice() * (o.deck.length + 1)), 0, x); L(g, `  Card Trick: ${x.d.name} is shuffled into ${who(g, o)}'s deck.`); }
    }) } : null;
  } },
  "Spelling Mistake": { play(g, p, c) {   // swap a creature's ATK and HP
    let best = null;
    for (const t of allUnits(g)) { const s = swapWorth(g, p, t); if (s != null && (!best || s > best.s)) best = { t, s }; }
    return best && best.s > 0.6 ? { pri: best.t.ctrl === p.i ? 3 : 1, score: best.s, run: () => cast(g, p, c, () => swapStats(g, best.t)) } : null;
  } },
  "Wild Magic": { play(g, p, c) {
    const choose = (p.sc || 0) + 1 >= 3, ev = [1, 2, 3, 4, 5, 6].map(r => wildWorth(g, p, r)), s = choose ? 3.6 : ev.reduce((a, b) => a + b, 0) / 6;
    return s > 0.6 ? { pri: 0, score: s, run: () => cast(g, p, c, () => wildMagic(g, p, (p.sc || 0) >= 3, 0)) } : null;
  } },
  "Extra Credit": { play(g, p, c) {   // only at Spellcount 3+: a creature you control can attack twice this turn
    if (g.phase !== 1 || g.turnNo === 1 || !scOk(p, c)) return null;
    let best = null;
    for (const u of units(p)) { if (u.extra) continue; const s = bestAttack(g, u); if (s > -Infinity && (!best || s > best.s)) best = { u, s }; }
    const s = best ? best.s * 0.6 - 0.6 : 0;
    return s > 0.5 ? { pri: 3, score: s, run: () => cast(g, p, c, () => { if (onField(g, best.u)) { best.u.extra = 1; L(g, `  ${best.u.d.name} can attack twice this turn.`); } }) } : null;
  } },
  "Pocket Fireball": { play(g, p, c) {
    const big = (p.sc || 0) + 1 >= 3, n = big ? 4 : 2, others = p.hand.filter(x => x !== c && oneShot(x)).length;
    let best = null; for (const t of units(foe(g, p))) { const s = damageWorth(g, p, t, n); if (!best || s > best.s) best = { t, s }; }
    if (!best) return null;
    const s = best.s - 0.8 - (!big && others >= 2 - (p.sc || 0) ? 1 : 0);
    return s > 0.5 ? { pri: 1, score: s, run: () => cast(g, p, c, () => { if (onField(g, best.t)) damage(g, best.t, (p.sc || 0) >= 3 ? 4 : 2, {}); }) } : null;
  } },
  "Big Fireball": { play(g, p, c) {
    if (!p.flux) return null;
    let best = null;
    const o = foe(g, p), face = says(c.d, /enemy creature or your opponent/i);
    const costOf = x => { let cost = 0; if (g.phase === 1) { const b0 = bestPlan(g, p).score; p.flux -= x; cost = b0 - bestPlan(g, p).score; p.flux += x; } return cost + descendHold(g, p, x); };
    for (const t of units(o)) {
      const x = Math.min(p.flux, t.hp);
      const s = damageWorth(g, p, t, x) - costOf(x) - 0.5; if (!best || s > best.s) best = { t, x, s };
    }
    if (face) { const x = p.flux, s = x * phpW(g, o) * (x >= o.php ? 100 : 1) - costOf(x) - 0.5; if (!best || s > best.s) best = { t: null, x, s }; }
    return best && best.s > 0.5 ? { pri: best.t ? 1 : 3, score: best.s, run: () => {
      if (p.flux < best.x) return; p.flux -= best.x; L(g, `${who(g, p)} pays ${best.x} flux for Big Fireball.`);
      cast(g, p, c, () => { if (!best.t) { L(g, `  Big Fireball hits ${who(g, o)} for ${best.x}.`); p.st.face += best.x; losePHP(g, o, best.x); } else if (onField(g, best.t)) damage(g, best.t, best.x, {}); });
    } } : null;
  } },
  "Déjà Vu": { play(g, p, c) {   // a one-shot spell from the Waste Repository, played as if from the hand, then banished
    let best = null;
    for (const x of p.waste.slice()) {
      const f = x.d.fx; if (!oneShot(x) || x.d.name === c.d.name || f.perm) continue;
      const i = p.waste.indexOf(x); p.waste.splice(i, 1); p.hand.push(x);
      let o = null; try { o = f.play(g, p, x); } finally { p.hand.splice(p.hand.indexOf(x), 1); p.waste.splice(i, 0, x); }
      if (o && (!best || o.score > best.o.score)) best = { x, o };
    }
    if (!best || best.o.score - 0.8 <= 0.4) return null;
    return { pri: best.o.pri, score: best.o.score - 0.8, run: () => cast(g, p, c, () => {
      const i = p.waste.indexOf(best.x); if (i < 0) return;
      p.waste.splice(i, 1); p.hand.push(best.x); L(g, `  Déjà Vu: ${best.x.d.name} again.`);
      best.o.run();
      for (const pile of [p.waste, p.hand]) { const j = pile.indexOf(best.x); if (j >= 0) { pile.splice(j, 1); p.oblivion.push(best.x); } }
    }) };
  } },
  "Polymorph": { play(g, p, c) {   // a Frog with 1 ATK and no effects; its HP stays
    let best = null;
    for (const t of units(foe(g, p))) { if (t.d.kind === "fusion" || t.frog) continue; const s = (expAtk(g, t) - 1) * 0.6 + (t.d.fx ? 1.5 : 0) + (t.d.fx && t.d.fx.value || 0) * 0.5 - 1; if (!best || s > best.s) best = { t, s }; }
    return best && best.s > 0.5 ? { pri: 1, score: best.s, run: () => cast(g, p, c, () => frogify(g, best.t, g.turnNo + 2)) } : null;
  } },
  "Spellbook": { perm: true, needs: x => (x.wizard || 0) >= 6, score: () => 2.2, endTurn(g, p, z) {
    if ((p.sc || 0) >= num(z.c.d, /spellcount is (\d+) or more/i, 3) && drawOk(p, 1)) { L(g, `  Spellbook: ${who(g, p)} draws a card.`); draw(g, p, 1); }
  } },
  "Community College of Magic": { perm: true, college: true, needs: x => (x.wizard || 0) >= 6, score: (g, p) => fieldFx(g, "college") ? 0 : 2 },
});

// The card text each effect above was written for (textHash). The editor compares it with the current text.
const FX_TEXT = {
  "Absolute Unit": "1pxmb2k",
  "Fossil Fuel Baron": "1n3f7ro",
  "The Flock": "aqsqq",
  "Blood Mage": "dvt03w",
  "Chimera": "y0h1ps",
  "Crack a pack": "1otyca6",
  "Thiefling Sleight of Hand": "1y85wt2",
  "Nuclear Waste": "ml7cd9",
  "Community College of Magic": "1gdfx4o",
  "Spellbook": "dgytun",
  "Spelling Mistake": "12ecaij",
  "Wild Magic": "yrjaff",
  "Extra Credit": "170vy9h",
  "Polymorph": "ltxtuh",
  "Déjà Vu": "1g2fpub",
  "Big Fireball": "i1gqu1",
  "Pocket Fireball": "1tcpcji",
  "Card Trick": "106mkim",
  "Abracadabra": "1ua8xnj",
  "Spellsword": "hzlbri",
  "Wizard Tower": "1xuvjyz",
  "The Archmage": "11g9ta0",
  "Battlemage": "12o21dh",
  "Head Librarian": "1mo9vux",
  "Night School Professor": "1qlkzrz",
  "Spell Slinger": "1mjllps",
  "Mail-Order Wizard": "1evmc4m",
  "Toad Familiar": "1ui173g",
  "Apprentice": "9k5vpj",
  "Neighborhood Watch": "w3o9t5",
  "Gregg's Vape": "8ujfm7",
  "Greggs": "1axuv7n",
  "The bodega": "8ydr59",
  "Costco Hot Dog and Soda Comb for $1.5": "kn6ur1",
  "Tax Evasion": "1pq4gq8",
  "HOA Complaint": "1u2cs31",
  "Purrramid": "1k6yd2r",
  "HOA President": "13lme0v",
  "The Local Legend": "sjsun9",
  "Mall Cop Gary": "7chnhh",
  "Nosy Neighbor": "1uz26ag",
  "Gregg's Dawg": "sqlodm",
  "Johnny '5 inches'": "9rzrnw",
  "Gregg's Friend Joe": "wza2hl",
  "Gregg": "1ltg8qp",
  "Cat": "lv3nyf",
  "Compsognathus": "qx59lb",
  "Velociraptor": "1r3r44s",
  "Dilophosaurus": "1x35ylb",
  "Ankylosaurus": "xkmu55",
  "Triceratops": "h4ioa",
  "Pteranodon": "18nvqfq",
  "Brontosaurus": "6arhh",
  "T-Rex": "7gtq1j",
  "TT-rex": "1mead2a",
  "Necrosaurus": "1a7rnrd",
  "Archaeologist": "zcpxne",
  "Fossil Record": "9ixkax",
  "Primordial Soup": "zksqi2",
  "Ritual Pit": "1y1hlbr",
  "Bull Run": "wo0nar",
  "Goblin Bank": "2h6mga",
  "Cherub": "1i4xkro",
  "Acolyte Adam": "1gn0xd8",
  "Sanctified Knight": "bww8hi",
  "Judicator Angel": "1m7vax1",
  "Chapel Guard": "jwsi1v",
  "Purifier Nun": "mt4i5s",
  "Bellkeeper Monk": "m752qs",
  "Beelzechud": "169aojl",
  "Carrion The Dark Duchess": "ywk7kl",
  "Nomed The Dark Viscount": "ntpdy7",
  "Renroc The Dark Marquis": "1vm6v6c",
  "Blood Priest": "1eg1uiq",
  "Blood Imp": "1shj6kh",
  "Vein Ripper": "8rzk2y",
  "Salem": "1q5hw2w",
  "Hemogoblin": "1mc553j",
  "Goblin": "1vi286c",
  "Penny Stock Goblin": "17185i0",
  "Sanctuary Bells": "gw6dsi",
  "Seraphim Wall": "1xi0gg8",
  "Fallen Angel": "hg5lep",
  "Lord Lazarus": "18spfgv",
  "Arch Cleric": "ccpu2t",
  "Beelzechad": "1jqtco5",
  "The Meat Cathedral": "18ydeum",
  "Ergof The Dark Emperor": "1x6i86",
  "Hop Goblin": "13so13u",
  "Divine Silence": "16r81in",
  "Divine Shelter": "103rf6k",
  "Open Vein": "1h3uaxc",
  "Sacrificial Lamb": "14qq9lo",
  "Market Crash": "7o36jn",
  "Loaded Dice": "kide18",
  "Blood Frenzy": "88e35t",
  "Blood Pact Summoning Circle": "1jpgxtw",
  "Goblin Shuffle": "1au5pap",
  "Goblin Stock Broker": "1qrqb09",
  "Energy Drink": "1eo04hn",
  "Jar of Materialism": "1frc2vt",
  "Microwave": "1xmfz69",
  "Pipebomb": "2hmwzv",
  "Space Squid": "udsda7",
  "Unfuse": "2rr8zr",
  "Goblin General": "v3esdv",
  "Gob-omber": "1o9ssaa",
  "Goblin Miner": "d8v9",
  "Scrooger": "ld1tn1",
  "Gabe": "1nktpyp",
  "Goblin Pit Boss": "11mmduo",
  "Mountain Orc": "1y9qf3n",
  "It's Free Fuse-Estate": "15ldyzt",
  "Crimson Altar": "1svaf0d",
  "Seraph of Judgment": "rbzf00",
  "Goblin King": "18zcw2n",
  "Goblin Bombardier": "5cjm6j",
  "Indulgence Seller": "1mjo2ok",
  "Market Research": "146xnsx",
  "Overclock": "omv5k",
  "Blood Ledger": "tz8u8v",
  "Boss's Orders": "18lwpa2",
  "Melting Pot": "9ifnp4",
  "Twisted Dimensions": "1ys5s",
  "Shotgun Wedding": "lzqift",
  "Claw Machine": "18u65sc",
  "Arcade Kid": "fs5awq",
  "Plush Collector": "7vt99a",
  "Plush Catalogue": "m8v2ln",
  "Needle and Thread": "10111wp",
  "Plush Cherub": "16zn475",
  "Plush Blood Imp": "1jq1dnd",
  "Plush Goblin": "1aamqke",
  "Plush Vein Ripper": "5h7gkh",
  "Plush Sanctified Knight": "sxbdhc",
  "Plush Judicator Angel": "1c3jdc3",
  "Plush Dark Duchess": "11ssl6r",
  "Patchwork Plush": "wvgafv",
  "Mega Plush": "4jejkb",
};

/* ---------------- the AI ---------------- */
function handCreatureOpts(g, p) {   // hand creatures with every way to pay for them (Blood Price)
  const W = phpW(g, p), spare = Math.floor(wasteSpare(p).length / 2), out = [];
  for (const c of p.hand) {
    const d = c.d; if (d.kind !== "creature" || d.flux == null || (fluffy(c) && !hasClaw(p))) continue;
    const disc = (d.fx && d.fx.patchwork ? Math.min(d.flux, p.waste.filter(fluffy).length) : 0)   // Patchwork Plush
      + (fluffy(c) && says(p.field.c.d, /'Fluffy' creatures cost (\d+) less flux/i) ? num(p.field.c.d, /'Fluffy' creatures cost (\d+) less flux/i, 0) : 0);   // Claw Machine
    const opts = [];
    for (let k = 0; k <= (d.bp || 0); k++) {
      const per = num(d, /pay (\d+) PHP(?: per flux)?: reduce this creature's flux cost/i, 3);   // Blood Price, from the card text
      let php = per * k, waste = 0;
      if (d.fx && d.fx.bpWaste) { const w = Math.min(k, spare); waste = 2 * w; php = per * (k - w); }
      opts.push({ flux: Math.max(0, d.flux - disc - k), php, waste, cost: php * W + waste * 0.15 });
    }
    out.push({ c, d, value: defValue(d) - (R.descend && descendOf(c) && units(p).length >= 2 ? 2 : 0), opts, unholy: hasAttr(d, "unholy") });
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
  const pot = fieldFx(g, "pot");   // Melting Pot: any flux cost can fuse
  const wedding = freeZone(p) ? p.hand.find(c => c.d.fx && c.d.fx.wedding) : null;
  const unit = x => !!x && (x.d.kind === "creature" || (R.fuseFusions && x.d.kind === "fusion"));
  const big = d => d.kind === "fusion" || pot || d.flux >= R.fuseMin;   // fusions count as 5+ flux (v4.5)
  const pairs = [];
  for (const [l1, l2] of [[0, 1], [1, 2]]) { const a = p.lanes[l1], b = p.lanes[l2]; if (unit(a) && unit(b)) pairs.push({ a, b }); }
  if (wedding) {   // Shotgun Wedding: a creature you control + a creature card from your hand
    const seenH = new Set();
    for (const c of p.hand) if (c.d.kind === "creature" && c.d.flux != null && !seenH.has(c.d.name) && seenH.add(c.d.name))
      for (const a of units(p)) if (unit(a)) pairs.push({ a, b: { card: c, d: c.d, splices: [] }, wed: true });
  }
  for (const { a, b, wed } of pairs) {
    const okA = big(a.d), okB = big(b.d), pitNeed = !(okA && okB);
    const pairOk = !(pitNeed && (wed || !(pit && ((okA && pitOk(b.d)) || (okB && pitOk(a.d))))));
    const carried = R.carryDamage ? fuseDamage(a) + (wed ? 0 : fuseDamage(b)) : 0;
    const n = 2 + spliceCount(a) + (wed ? 0 : spliceCount(b));   // fusion splices the new fusion would have
    const lose = keepWorth(g, a) + (wed ? defValue(b.d) * 0.75 : keepWorth(g, b));
    const seen = new Set();
    for (const fc of p.fdeck) {
      if (seen.has(fc.d.name)) continue; seen.add(fc.d.name);
      if (!recipeFits(fc.d.recipe, [a.d, b.d]) || carried >= fc.d.hp) continue;
      const any = anyCost(fc.d); if (!pairOk && !any) continue;   // v4.7: "can be made from creatures of any flux cost"
      const usesPit = pitNeed && !any;
      const extra = (fc.d.fx && fc.d.fx.perSplice || 0) * (n - 2);
      const gain = defValue(fc.d) + extra - carried / 2 - lose - (usesPit ? 0.5 : 0) + 1 - (wed ? 0.6 : 0);
      const lanes = wed ? 0 : 1, w = wed ? { wedding } : {};
      if (p.flux >= R.fuseFlux) out.push({ gain, flux: R.fuseFlux, lanes, uses: wed ? b.card : null, run: () => fuse(g, p, a, b, fc, { kind: "flux", pit: usesPit, ...w }) });
      if (wed) continue;
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
    const pool = fo && fo.uses ? crea.filter(e => e.c !== fo.uses) : crea;   // Shotgun Wedding uses that hand creature
    const sub = bestSubset(g, p, pool, p.flux - (fo ? fo.flux : 0), empty + (fo ? fo.lanes : 0), p.pact);
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
  if (c.d.kind === "field") { if (p.field && !(f.claw && !hasClaw(p) && (units(p).some(fluffy) || p.hand.some(fluffy)))) return null; }
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
// Reactor Phase: the normal +1 max flux, Feed (also a card to Oblivion for +1 flux this turn) or Skip (no +1, draw a card),
// whichever helps most now, with the sloppy player's misjudgement like every choice. Called after the refill.
function reactorChoice(g, p, first) {
  const plan = extra => { p.flux += extra; const s = bestPlan(g, p).score; p.flux -= extra; return s; }, base = plan(0);
  const up = !first && p.maxFlux < R.fluxMax;   // the normal +1 max flux does something
  const normal = (up ? 2.2 + (plan(1) - base) : 0) + jitter(g, p);
  const skipOk = !first && p.deck.length && (R.holdAtCap || p.maxFlux < R.fluxMax);
  const skip = skipOk ? (p.hand.length <= 1 ? 3.5 : p.hand.length <= 3 ? 2.5 : p.hand.length < R.handLimit - 1 ? 1.5 : 0) + jitter(g, p) : -99;
  let feed = -99, c = null;
  if (p.hand.length) {
    c = p.hand.slice().sort((a, b) => holdWorth(a) - holdWorth(b))[0];
    const i = p.hand.indexOf(c); p.hand.splice(i, 1); const fed = plan((up ? 1 : 0) + 1); p.hand.splice(i, 0, c);
    feed = (up ? 2.2 : 0) + (fed - base) - holdWorth(c) + jitter(g, p);
  }
  if (skip > normal && skip > feed) { L(g, `  Reactor: Skip, no extra max flux, draws a card.`); draw(g, p, 1); p.st.reactor[2]++; return; }
  if (up) { p.maxFlux = Math.min(R.fluxMax, p.maxFlux + 1); p.flux += 1; }
  if (feed > normal && c) {
    p.hand.splice(p.hand.indexOf(c), 1); g.p[c.owner].oblivion.push(c); p.flux += 1; p.st.reactor[1]++;
    L(g, `  Reactor: feeds it ${c.d.name}: ${p.flux}/${p.maxFlux} flux.`);
  } else p.st.reactor[0]++;
}
// what a card in hand is worth keeping, for choosing what goes under the Reactor: a creature its stats, a spell about 2
const holdWorth = c => isUnitKind(c.d.kind) ? defValue(c.d) * 0.4 : 2 + (says(c.d, /\bdraw\b/i) ? 1.5 : 0);
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
      for (const a of f.acts) {   // a Complaint stops "once per turn" effects; a "free" act (Wizard Tower) isn't once per turn
        const key = u.d.name + ":" + a.id;
        if (!a.free && (u.complaints || p.once.has(key))) continue;
        const o = a.ai(g, u); if (o) { if (!a.free) o.key = key; if (o.pri === undefined) o.pri = a.pri; add(o); }
      }
    }
    add(fossilOption(g, p));
    add(fineOption(g, p));
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
    g.pendingWorth = o.score; o.run(); g.pendingWorth = null;
    clawCheck(g);
    checkEnd(g);
  }
}
function battle(g, p) {
  const o = foe(g, p);
  for (let guard = 0; guard < 10 && !g.over; guard++) {
    let best = null;
    for (const u of units(p)) {
      if ((u.attacked && !u.extra) || expAtk(g, u) <= 0 || (R.sick && u.arrived === g.turnNo) || lockedOut(g, u)) continue;   // Extra Credit: a second attack
      for (const l of [u.lane].concat(NB[u.lane])) { const t = o.lanes[l]; if (t) { const s = scoreFight(g, u, t) + jitter(g, p); if (!best || s > best.s) best = { s, u, t }; } }
      if (canFace(g, u)) { const s = scoreFace(g, u) + jitter(g, p); if (!best || s > best.s) best = { s, u, t: null }; }
    }
    if (!best || best.s <= 0.2) break;
    if (best.u.attacked) best.u.extra = 0;
    if (best.t) fight(g, best.u, best.t); else directAttack(g, best.u);
    clawCheck(g);
  }
}
function endTurn(g, p) {
  for (const u of units(p)) { const f = fxOf(u); if (f && f.endTurn) f.endTurn(g, u); if (g.over) return; }
  for (const u of units(p)) if (u.frenzy) { sacrifice(g, p, u); if (g.over) return; }
  for (const q of g.p) if (q.field && q.field.c.d.fx && q.field.c.d.fx.endEachTurn) q.field.c.d.fx.endEachTurn(g, q);
  for (const z of spellsOf(p)) { const f = z.c.d.fx; if (f && f.endTurn) { f.endTurn(g, p, z); if (g.over) return; } }
  for (const u of units(p)) if (u.stolen && u.stolen.until !== "start") giveBack(g, u);
  for (const u of units(p)) if (u.vape) { u.vape = false; L(g, `  No vaping indoors:`); complain(g, u); }   // Gregg's Vape
  for (const u of allUnits(g)) if (u.frog && g.turnNo >= u.frog.until) { u.die = u.frog.die; u.hp = Math.min(u.maxHp, u.frog.hp); u.frog = null; L(g, `  ${u.d.name} turns back from a Frog (${u.hp} HP).`); }
  const opp = foe(g, p);   // Neighborhood Watch: one of the opponent's 2 turns is over
  for (const z of opp.zones.slice()) if (z.watch && --z.watch <= 0) { opp.zones.splice(opp.zones.indexOf(z), 1); toWaste(g, z.c); L(g, `  ${z.c.d.name} goes to the Waste Repository.`); }
  clawCheck(g);
  for (const u of allUnits(g)) { u.tAtk = 0; u.tSpd = 0; u.negated = false; u.extra = 0; }
  while (p.hand.length > R.handLimit) {
    const c = p.hand.slice().sort((a, b) => keepValue(g, p, a) - keepValue(g, p, b))[0];
    p.hand.splice(p.hand.indexOf(c), 1); toWaste(g, c);
  }
}
function playTurn(g) {
  const p = g.p[g.active], o = foe(g, p);
  g.turnNo++; p.turns++;
  g.p.forEach(q => { q.once.clear(); q.sc = 0; });   // Spellcount (v4.7) counts this turn's spells
  p.fused = false; p.pact = 0; g.phase = 0;
  const first = p.turns === 1;
  if (!(first && g.first === p.i)) { draw(g, p, 1); if (g.over) return; }
  if (R.ink) p.maxFlux = Math.min(R.fluxMax, R.inkBase + p.reactor.length);
  else if (!first && !R.reactor) p.maxFlux = Math.min(R.fluxMax, p.maxFlux + 1);   // with R.reactor, reactorChoice does it
  p.flux = p.maxFlux + (first && g.first !== p.i ? R.secondFlux : 0);
  L(g, `— Turn ${g.turnNo}: ${who(g, p)} · ${p.php} PHP vs ${o.php} · ${p.flux} flux${p.gold ? ` · ${p.gold} gold` : ""} —`);
  if (g.log) L(g, `  Hand: ${p.hand.map(c => c.d.name).join(", ") || "empty"}.`);
  for (const u of units(p)) if (u.stolen && u.stolen.until === "start") giveBack(g, u);   // Space Squid (v4.6) ends now
  if (R.reactor) { reactorChoice(g, p, first); if (g.over) return; }
  for (const u of units(p)) { if (u.radHp) { u.hp = Math.min(u.hp, u.maxHp); u.radHp = 0; } u.radAtk = 0; u.attacked = false; u.winded = false; }
  for (const q of g.p) for (const z of spellsOf(q).slice()) if (z.bomb && z.bomb.by === p.i) removeSpell(g, q, z, "Pipebomb");
  for (const c of p.lazarus.splice(0)) {
    const i = p.waste.indexOf(c);
    if (i >= 0 && emptyLanes(p).length) { p.waste.splice(i, 1); materialize(g, p, c, chooseLane(g, p, c.d), "lazarus"); }
    else if (c.under) { const rest = c.under; c.under = null; wasteAll(g, rest); }   // no lane: its splices go to the Waste Repository too
  }
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
  // a deck's core spell goes in 3 times (Claw Machine for decks with Fluffy creatures)
  for (const d of all) if (!isUnitKind(d.kind) && d.fx && d.fx.core && d.fx.core(deckCre)) add(d, 3);
  const pitTargets = deckCre.filter(pitOk).length;
  const canPit = pitTargets && all.some(d => d.name === "Ritual Pit" && inF(d));
  const big = deckCre.filter(d => d.flux >= R.fuseMin);
  const fusions = all.filter(d => d.kind === "fusion" && (big.some((a, i) => big.some((b, j) => (i !== j || counts.get(a.name) > 1) && recipeFits(d.recipe, [a, b])))
    || (canPit && big.some(a => deckCre.some(b => pitOk(b) && recipeFits(d.recipe, [a, b]))))));
  // each fusion it could make goes in 60% of the time, so the stats can compare decks with and without it
  const fcounts = new Map(); let fn = 0;
  for (const d of shuffle(rng, fusions.slice())) { if (rng() >= 0.6) continue; const k = Math.min(10 - fn, rng() < 0.5 ? 1 : 2); if (k > 0) { fcounts.set(d.name, k); fn += k; } }
  const ctx = { fusions: fn, pitTargets, unholy: 0, dice: 0 };
  for (const [k, q] of counts) { const d = defs.get(k); if (hasAttr(d, "unholy")) ctx.unholy += q; if (hasAttr(d, "prehistoric")) ctx.dino = (ctx.dino || 0) + q; if (hasAttr(d, "arcane")) ctx.wizard = (ctx.wizard || 0) + q; if (d.die) ctx.dice += q; }
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
return { R, RULEBOOK, withRules, FX, SPELLS, FX_TEXT, textHash, rngFrom, prep, randomDeck, deckFromList, playGame, record, runMany, coverage, recipeFits, pitOk };
})();
