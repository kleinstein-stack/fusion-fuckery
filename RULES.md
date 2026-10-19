# Fusion Fuckery: Rulebook v3 (gameplay v2)

Decided on 2026-10-19. This replaces the Rulebook v2.1 (*The Blocking Update*) wherever the two disagree; everything
v2.1 says that isn't covered here still applies. The Dino, Mutant, Parasite, Bleed and Equipment rules are only in
v2.1, because those cards are in cold storage. The card editor's checks and simulators use these numbers
(`PLAY` in `tools/editor-template.html`).

## 1. The Golden Rules

1. **The card wins.** If a card's text contradicts this rulebook, do what the card says.
2. **Can't beats can.** If one effect says you can and another says you can't, you can't.
3. **Do as much as you can.** If you can only partly do what a card says, do that part and skip the rest.
4. **Your cards, your job.** You're responsible for remembering and triggering your own effects (15.1).
5. **Newest first.** When effects pile up, the last one played resolves first (10.5).

## 2. How to win

- Each player starts with **30 PHP** (Player Health Points). Get your opponent to **0 PHP** and you win.
- PHP drops from unblocked attacks, damage and "lose PHP" effects, and from paying PHP for your own cards. You
  can pay yourself to 0, and then you lose.
- **Running out of cards doesn't knock you out.** Each time you'd draw from an empty deck, you lose 5 PHP instead.
- If both players hit 0 PHP at the same time, the game is a draw.

## 3. What you need

- A **Main Deck** of exactly 30 cards and a **Fusion Deck** of up to 10 fusions.
- Dice: a d20, d12, d10, d8, d6, d4 and d2 (a coin) cover every Goblin. Something to track PHP, Gold and damage.
- Your own coin.

## 4. Setting up

1. Shuffle your Main Deck and offer it to your opponent to cut. Put your Fusion Deck face up next to your field.
2. Both players start at **30 PHP** and **0 Gold**.
3. Flip a coin. The winner decides who goes first.
4. Each player draws **5 cards**.
5. **Mulligan:** only if **both players agree**. Then both shuffle their hands back and draw 5 new cards, once.
6. The first player skips their first draw and can't attack on their first turn.
   The second player gets **+1 flux on their first turn** (4 instead of 3).

## 5. The play area

| Zone | What it is |
|---|---|
| **Lanes (3)** | Your creature zone. One creature or fusion per lane, so max 3. |
| **Spell zones (3)** | Every spell is played into an empty spell zone. One-shot spells (Spell, Instant Spell) leave after they resolve; Continuous Spells stay. |
| **Field Spell zone (1)** | **1 Field Spell per player.** Playing a new one sends your old one to your Waste Repository. |
| **Deck** | Your Main Deck, face down. |
| **Fusion Deck** | Your fusions, face up. Anyone can look through it. |
| **Waste Repository** | Your face-up discard pile. Used, destroyed and discarded cards go here. |
| **Oblivion** | Face up. Banished cards go here and never come back unless a card says so. |

- Your hand and Deck are hidden; everything else is public. Hand *size* is public.
- **Lanes:** when you play a creature, you choose any empty lane. Creatures only change lanes when a card effect
  says they may.
- **In front of:** the enemy creature in the same lane, directly across.
- **Lanes next to it:** the lane(s) directly left and right. The middle lane has two, the outer lanes have one.
- **Adjacent** (when a card uses the keyword): the creature in front of it plus the creatures in the lanes next to it
  on its own side. Empty lanes don't count as anything.

## 6. Building a deck

- **Main Deck:** exactly 30 cards. **Fusion Deck:** up to 10 fusions, not counted in the 30.
- **Max 3 copies** of any card by name, in both decks.
- Mix factions however you like. Neutral cards fit in any deck.

## 7. Flux

- Flux pays for creatures. **Spells are free.** Fusing costs 2 flux (13).
- You start at **3 max flux**. In your Reactor Phase (except your first turn) raise your max flux by 1, then refill.
  Max flux caps at **10**.
- Unused flux disappears at the end of your turn. Count your own turns only.
- Discounts can't push a cost below 0.

## 8. Turn structure

| # | Phase | What happens |
|---|---|---|
| 1 | Draw | Draw **1** card (the first player skips this on their first turn). |
| 2 | Reactor | Max flux +1 (not on your first turn), then refill. |
| 3 | Start | Start-of-turn effects. |
| 4 | Main 1 | In any order: materialize creatures, play spells, activate effects. **One fusion** (13). |
| 5 | Battle | Attack (12). Nobody attacks on the first turn of the game. |
| 6 | Main 2 | Spells and effects. No natural materializing and no fusing. |
| 7 | End | End-of-turn effects → Radiance wears off (14.1) → discard down to 8 cards. |

## 9. Materializing creatures

- **Natural materialize:** in Main Phase 1, from your hand. Pay its flux cost (Blood Demons may pay part of it
  with **Blood Price**, 14.2), then put it in any empty lane. No limit beyond flux and lanes.
- **By effect** (Carrion Duchess, The Meat Cathedral…): happens whenever the effect says, without paying flux. It
  still needs an empty lane.
- "When materialized" effects trigger both ways.
- **Creatures can attack the turn they arrive.** No summoning sickness.

## 10. Spells

1. **Spell:** your Main Phases only. Can't be played in response.
2. **Instant Spell:** your Main Phases, **on your opponent's turn**, **during combat**, or in response to any card
   or effect.
3. **Continuous Spell:** stays in its spell zone until something removes it.
4. **Field Spell:** stays in your Field Spell zone. "Your" on a Field Spell means its owner.
5. **Chains:** whenever a card or effect is played or activated, the other player may respond with an Instant, then
   the first player may respond to that, and so on. When both pass, the chain resolves **newest first**.
6. Activated creature effects ("Once per turn: …") are only used in your Main Phases unless the card says
   otherwise. Triggered effects ("When…", "Whenever…", "At the end of…") happen whenever they trigger.

## 11. Health, damage & destruction

**Player health (PHP).** There's **no maximum**; few cards add PHP.

| Card says | What happens |
|---|---|
| Restore / gain PHP | Add it. No cap. |
| Pay PHP | A cost. Always payable, even if it drops you to 0 (and then you lose). |
| Lose PHP | Any drop: damage, paying, or "lose X PHP". Pain Drinker and Skinless Titan care about this. |

**Creature HP.** Damage stays on a creature until something restores its HP. Nothing heals by itself.

| Term | Meaning |
|---|---|
| Current HP | The HP it has right now. |
| Max HP | Printed HP + permanent gains − permanent losses. |
| Restore HP | Heal Current HP. Never above Max HP, except with Radiance (14.1), and Max HP doesn't change. |
| Give HP (or "+X HP") | **Permanent.** Raise both Current and Max HP. |
| Permanently gain / lose HP | Raise / lower both Current and Max HP. |

**Give vs restore.** A creature at 1/3 HP (Current/Max) that is **given** 3 HP becomes **4/6**. If 3 HP is
**restored** instead, it becomes **3/3**.

- A creature at 0 HP or less is **destroyed** and goes to its owner's Waste Repository. "Destroyed", "dies" and
  "killed" mean the same thing. **Sacrificing** a creature destroys it as a cost.
- **Banished** cards go to Oblivion. They aren't destroyed, so death effects don't trigger.
- Death effects trigger after the card reaches the Waste Repository. If several die at once, the player whose turn
  it is resolves theirs first.
- **Prevent** stops damage; **reduce** lowers it. Damage reduced to 0 counts as no damage dealt.

## 12. Combat

1. In your Battle Phase, each of your creatures can **attack once per turn**, one attack at a time.
2. **Choose a target.** An attacker can hit the enemy creature **in front of it** or in **a lane next to it** (the
   middle lane reaches all three enemy lanes).
3. **Direct attacks:** if nothing is in front of it, it may attack the **player** instead. Enemy creatures in the
   lanes next to it hit it back with their ATK.
4. **Response window:** after the attack is declared, the defending player, then the attacking player, may play
   Instants. "When this creature attacks" effects trigger when the attack is declared.
5. **Speed decides who hits first.** Speed runs 1–4; 2 is normal. The faster creature deals its damage first; on a
   tie the attacker goes first. If the first hit destroys the other creature, it doesn't hit back. On a direct
   attack, enemies faster than the attacker hit it before it reaches the player; slower ones hit it after.
6. Damage dealt in combat stays (11).

## 13. Fusion

Fusions are the end goal: each one is stronger than an Ultra.

- **Once per turn, in Main Phase 1, pay 2 flux to fuse.** Choose **2 creatures you control in lanes next to each
  other**, both with a printed cost of **5 or more flux**, that meet the recipe in {curly brackets} on a fusion in
  your Fusion Deck.
- Put the two creatures **under** the fusion card. They're now its materials, not creatures. Put the fusion in
  either of their lanes; the other lane is free again.
- The fusion arrives at its own printed stats and full HP, and **can attack this turn**.
- **Ways around the 2 flux:** **It's free fuse-estate** (spell) lets you fuse without paying it. **Crimson Altar**
  (Blood Demon field spell) lets you sacrifice another Blood Demon instead.
- **A cheaper material:** **Ritual Pit** (Blood Demon continuous spell) is the one exception to the 5+ flux rule. Banish
  a Blood Demon card from your Waste Repository: your next fusion this turn may use a 3–4 flux Blood Demon as a
  material. You still pay the 2 flux.
- **Recipes:** a card name means that exact card; an attribute ("any Holy creature") means any creature with it.
- **Nothing carries over:** a fusion only has the effect printed on its own card. Its materials' effects, stats,
  damage and stat changes don't carry over. (This replaces v2.1 and the V5 rule where splice effects carried over.)
- **When a fusion is destroyed**, the fusion card and its materials go to your Waste Repository. Only the fusion's
  own death effects trigger; the materials' don't.

## 14. Faction mechanics

### 14.1 Angels: Radiance
When a Holy card **restores** HP, it can go past Max HP. This is never permanent: Max HP doesn't change, and each
point over Max HP is **+1 ATK until end of turn**. At the end of the turn the extra HP and the ATK both go away.
Example: a 3/3 creature restored by 2 becomes 5/3 with +2 ATK this turn, then goes back to 3/3. (Giving HP is
different: it's permanent and raises Max HP, see 11.)

### 14.2 Blood Demons: Blood Price
**Blood Price N:** when you naturally materialize it, you may pay **2 PHP for each flux you skip**, up to N. The
printed cost still decides tier and fusion eligibility.

### 14.3 Goblins: Dice & Gold
- **Dice:** a Goblin's ATK like "1+d6" is **rolled every time it attacks**, for that attack only. When it hits back
  in a fight, it rolls too. "Natural 20" / "natural 1" means the die itself showed that number.
- **Gold:** everyone starts with **0 Gold**; there's **no cap**. Only cards that mention Gold can make, spend or move
  it. Invested Gold is locked into that card and lost if the card leaves the field.
- **Market Cycle** (from v2.1): with 5–9 Gold your Goblin creatures get +1 ATK, with 10+ they get +2 instead. If you
  end your turn with 10+ Gold, roll a d6: 1–2 lose half your Gold, 3–5 nothing, 6 gain 2 Gold.

## 15. Advanced rules

1. **Forgotten effects:** a forgotten optional effect ("may") is gone. A forgotten mandatory one is resolved if it's
   caught the same turn.
2. **Reading card text:** "at the start/end of your turn" = your own turn only; "each turn" / "every turn" = both
   players' turns; "until end of turn" wears off at the end of the current End Phase; "any creature" = either side;
   "enemy creature" = one your opponent controls. Halves round down.
3. **Negate:** the creature has no card text until the negation ends. Its stats, name, faction and attributes stay.
4. **Owner & controller:** cards always go to their *owner's* hand, deck, Waste Repository or Oblivion.
5. **Hand limit:** 8, checked at the end of every turn.
6. **Searching your deck:** shuffle afterwards and offer the cut.
7. **Once per turn / once per game:** counted per effect name, so 3 copies of a card still get one activation.
8. **Targeting:** an effect targets when it chooses a specific card. Attacking isn't targeting for "untargetable".
9. **Simultaneous effects:** the player whose turn it is resolves theirs first, in the order they choose.

## 16. Quick reference

| | |
|---|---|
| Starting PHP | 30, no maximum |
| Main Deck / Fusion Deck | 30 / up to 10, max 3 copies |
| Opening hand | 5 (mulligan only if both agree) |
| Draw per turn | 1 (first player skips their first) |
| Flux | starts 3, +1 a turn, max 10. Second player +1 on their first turn |
| Lanes / spell zones / field spells | 3 / 3 / 1 per player |
| Fusing | once per turn, 2 flux, two 5+ flux creatures in lanes next to each other |
| Empty deck | lose 5 PHP for each draw you can't make |
| Hand limit | 8 |

## Designer notes: stat budget

points = ATK + HP ÷ 2 + (Speed − 2) + Blood Price ÷ 2 + effect, aiming for **2 × flux + 1** (about 20 for Ultras)
and **28 for fusions**. Two 5-flux materials are worth 22, so a fusion pays them back plus the fuse.

- Dice count at their average (a d6 is 3.5).
- Speed steps count double on creatures with 8+ ATK.
- Effects: small ≈ 1, repeatable 2–3, removal or an engine 4+.
- Cards costing 1–3 may be up to 1 point over.
- Cost tiers per faction: 8 creatures in a 2 : 3 : 2 : 1 spread (Low 1–3, Medium 4–5, High 6–8, Ultra 9–10).
