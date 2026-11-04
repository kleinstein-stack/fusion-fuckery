# Fusion Fuckery: Rulebook v4.7 (gameplay v2)

Decided on 2026-10-19. This replaces the Rulebook v2.1 (*The Blocking Update*) wherever the two disagree; everything
v2.1 says that isn't covered here still applies. The Mutant, Parasite, Bleed and Equipment rules are only in v2.1,
because those cards are in cold storage (the Dinos and the Mundane cards came back in v4.7 with new rules, 14.5 and 14.6). The player-facing version with diagrams is
`Fusion Fuckery Rulebook v4.7 (editable).docx` (opens in Google Docs) and `Fusion Fuckery Rulebook v4.7.pdf`. The card editor's checks and simulators use these numbers
(`PLAY` in `tools/editor-template.html`, `R` in `tools/battle-sim.js`).

**v4.3 (2026-10-21):** 40 starting PHP (was 30), a free redraw for an opening hand with 0 or 1 creatures, and creatures
can't attack the turn they arrive (they could before). In the battle sim these made games longer with more lead
changes, made an early lead matter less and got fusions made in far more games. The v4.2 cards, decks and rulebook are
saved under the git tag `save-before-v4.3-rules` and in `saves/versions/` ("SAVE before v4.3 rules").

**v4.4 (2026-10-21):** Reactor Phase choices (Feed the reactor or Skip, 7), Winded attackers (12), back to 30 starting
PHP, 16 card changes, two new cards (Overclock, Blood Ledger) and new starter decks. In the battle sim this made good
play count for much more (a careful player beats a sloppy copy of itself with the same deck about 62% of the time, up
from 52%), made close finishes three times as common and brought the factions' head-to-heads to about 50%. The v4.3
cards, decks and rulebook are saved under the git tag `save-before-v4.4` and in `saves/versions/` ("SAVE before v4.4
rules").

**v4.5 (2026-10-27): fusion splices.** New rules (13): a fusion keeps the damage its fusion splices had and arrives
winded; two fusions can be fused, and every card in the stack counts as a fusion splice; Unfuse splits the fusion's
damage between the splices it returns (never below 1 HP) and keeps them winded; on a direct attack, winded creatures
next to the attacker still hit back, last (12). Every fusion now uses its fusion splices, by banishing one for an effect
or by counting them. Blood Ledger is a Continuous Spell (was a Field Spell). New cards: Boss's Orders, Melting Pot,
Twisted Dimensions and Shotgun Wedding. Creatures that cost 5+ flux, the ones that can fuse, get a gold flux badge.
**New faction: Plushies** (14 cards, a starter deck; see 14.4).
In the battle sim (4,000 games a run) the new rules on their own barely moved game length, comebacks, close finishes
or how much skill matters (a careful player still beats a sloppy copy of itself about 65% of the time); the fusion
rewrites needed three fixes (Arch Cleric, The Meat Cathedral, Seraph of Judgment) to keep any fusion from being
"too strong". The v4.4 cards, decks and rulebook are saved under the git tag `save-before-v4.5` and in
`saves/versions/` ("SAVE before v4.5 rules").

**v4.6 (2026-11-03): after the first playtest.** Speed now runs **1–8** (4 is normal) instead of 1–4, so creatures differ
more and the attacker's +1 no longer decides most fights; a **speed tie is a coin flip** (it used to go to the attacker).
Every creature and fusion got a new Speed; Blood Frenzy and Hemogoblin give +2 Speed (was +1) to keep their size.
**Space Squid** now costs PHP equal to the creature's flux cost (10 for a fusion), lasts until the start of your next
turn and un-winds the creature; you can't play it without an empty lane. **Claw Machine** only lets you materialize
Fluffy creatures (no discount, no slipping past blockers, no card draw), and Fluffy creatures stay when it leaves;
**Plush Cherub** now draws a card whenever another of your Fluffy creatures dies. **Goblin Bombardier** banishes a
fusion splice for 6 damage and 2 to the creatures next to the target. **The Meat Cathedral** was too strong: 7/20
(was 8/24), 3 HP or 3 PHP (was 4) and +1 ATK (was +2). Goblins and gold were confirmed balanced. The v4.5 cards, decks
and rulebook are saved under the git tag `save-before-v4.6` and in `saves/versions/` ("SAVE before v4.6 rules").

**v4.7 (2026-11-04): three factions and Descend.** **Dinos are back** (14.5): a Waste Repository deck built on
**Fossil**, with **Stampede** on Triceratops, Brontosaurus and T-Rex (Dino Egg and Egg Incubator stay in cold storage).
**Mundane is back** (14.6): Gregg and the neighbourhood bury the opponent in **Complaints**; Bunny, Cabbit and Bad Bunny
Concert Tickets stay in cold storage, and Nosy Neighbor, Mall Cop Gary and Neighborhood Watch are new. **New faction:
Wizards** (14.8), a spellslinger deck built on **Spellcount**, where every spell does a different job. **Angels get Descend** (14.7): Purifier Nun, Sanctified
Knight, Chapel Guard, Judicator Angel and Gabe can be materialized on the opponent's turn when an enemy attacks, and the
attack hits them instead; Bellkeeper Monk and Sanctuary Bells make it cheaper. **Spell review:** Pipebomb is now an
Instant that destroys a spell, either as it's played or one already in play (10.7); Energy Drink also
gives +2 Speed; Twisted Dimensions' text now says a tie is still a coin flip (the v4.6 rule). New starter decks:
Jurassic Junkyard, Bone Yard, Red Tape and Night School. The v4.6 cards, decks and rulebook are saved under the git tag
`save-before-v4.7` and in `saves/versions/` ("SAVE before v4.7 rules").

## 1. The Golden Rules

1. **The card wins.** If a card's text contradicts this rulebook, do what the card says.
2. **Your cards, your job.** You're responsible for remembering and triggering your own effects (15.1).
3. **Newest first.** When effects pile up, the last one played resolves first (10.5).

## 2. How to win

- Each player starts with **30 PHP** (Player Health Points). Get your opponent to **0 PHP** and you win.
- PHP drops from direct attacks, from card effects that deal damage or make you lose PHP, and from paying PHP for
  your own cards. You can pay yourself to 0, and then you lose.
- **Running out of cards doesn't knock you out.** Each time you'd draw from an empty deck, you lose 5 PHP instead.
- If both players hit 0 PHP at the same time, the game is a draw.

## 3. What you need

- A **Main Deck** of exactly 30 cards and a **Fusion Deck** of up to 10 fusions.
- Dice: a d20, d12, d10, d8, d6, d4 and d2 (a coin) cover every dice ATK. Something to track PHP, Gold and damage.
- Your own coin.

## 4. Setting up

1. Shuffle your Main Deck and offer it to your opponent to cut. Put your Fusion Deck face up next to your field.
2. Both players start at **30 PHP** and **0 Gold**.
3. Flip a coin. The winner decides who goes first.
4. Each player draws **5 cards**.
5. **Free redraw:** if your opening hand has **0 or 1 creatures**, you may show it, shuffle it back into your deck and
   draw 5 new cards. Once per game, and you keep the new hand.
6. **Mulligan:** only if **both players agree**. Then both shuffle their hands back and draw 5 new cards, once.
7. The first player skips their first draw and can't attack on their first turn.
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
| **Oblivion** | Face up. Banished cards and cards fed to the reactor (7) go here and never come back unless a card says so. |

- **Layout** (each side mirrors the other): lanes nearest the middle of the table; behind them the spell row, left to
  right Field Spell zone then 3 spell zones; Oblivion and Waste Repository on the left (Oblivion nearer the lanes);
  Fusion Deck and Deck on the right (Fusion Deck nearer the lanes).
- Your hand and Deck are hidden; everything else is public. Hand *size* is public.
- **Lanes:** when you play a creature, you choose any empty lane. Creatures only change lanes when a card effect
  says they may.
- **In front of:** the enemy creature in the same lane, directly across.
- **Lanes next to it:** the lane(s) directly left and right. The middle lane has two, the outer lanes have one.
  (Card text says "the lanes next to it", never "adjacent".)

## 6. Building a deck

- **Main Deck:** exactly 30 cards. **Fusion Deck:** up to 10 fusions, not counted in the 30.
- **Max 3 copies** of any card by name, in both decks.
- Any card can go in any deck.

## 7. Flux

- Flux is what you spend to materialize and fuse creatures (fusing costs 2, see 13). **Spells are free.**
- You start at **3 max flux**. In your **Reactor Phase** raise your max flux by 1 (not on your first turn), then
  refill. Max flux caps at **10**. You may also choose **one** of these:
  - **Feed the reactor:** send 1 card from your hand to Oblivion for **+1 flux this turn**. Your max flux doesn't
    change: at 7/7 you feed and have 8/7, and next turn you go to 8/8 as normal. You can feed on your first turn too.
  - **Skip:** don't raise your max flux this turn (you still refill) and **draw 1 extra card**. Not on your first
    turn. You can skip at 10 max flux too.

  Your normal draw (8) always happens, whatever you choose.
- Leftover flux doesn't do much: your next Reactor Phase refills you to your max anyway.
- Turns are counted per player: your 3rd turn is the third turn you've taken, no matter who went first.
- A discount **can** push a cost below 0, and then you gain the difference: a creature that costs −1 flux gives you
  1 flux when you play it.

## 8. Turn structure

| # | Phase | What happens |
|---|---|---|
| 1 | Draw | Draw **1** card (the first player skips this on their first turn). |
| 2 | Reactor | Max flux +1 (not on your first turn), then refill. You may also **Feed** (a card from your hand to Oblivion: +1 flux this turn) or **Skip** (no +1 max flux, draw 1 card) (7). |
| 3 | Start | Radiance bonuses from your last turn end → start-of-turn effects. |
| 4 | Main 1 | In any order: materialize creatures, play spells, activate effects. **One fusion** (13). |
| 5 | Battle | Attack (12). Nobody attacks on the first turn of the game, and creatures that arrived this turn can't attack. |
| 6 | Main 2 | Spells and effects. No natural materializing and no fusing. |
| 7 | End | End-of-turn effects → discard down to 8 cards. |

## 9. Materializing creatures

- **Natural materialize:** in Main Phase 1, from your hand. Pay its flux cost (some creatures let you pay part of it
  in PHP with **Blood Price**, 14.2), then put it in any empty lane. No limit beyond flux and lanes.
- **By effect** (Carrion The Dark Duchess, Lord Lazarus…): happens whenever the effect says, without paying flux. It
  still needs an empty lane.
- "When materialized" effects trigger both ways.
- **Creatures can't attack the turn they arrive.** A creature or fusion that was materialized, fused or brought back
  this turn waits until your next turn to attack. It still hits back when it's attacked, except a fusion, which arrives
  winded (13). Taking control of a creature (Space Squid) isn't arriving, so that creature can attack. Neither is being
  moved to another lane (Boss's Orders).

## 10. Spells

The symbol in a spell's top-right corner shows its type: a lightning bolt for Instant Spells, a circle of arrows for
Continuous Spells, a mountain for Field Spells. A normal Spell has no symbol.

1. **Spell:** your Main Phases only. Can't be played in response.
2. **Instant Spell:** your Main Phases, **on your opponent's turn**, **during combat**, or in response to any card
   or effect.
3. **Continuous Spell:** stays in its spell zone until something removes it. It **affects you** (your side).
4. **Field Spell:** stays in your Field Spell zone and **affects everything on the field**, both sides. "Your" on a
   Field Spell means its owner.
5. **Chains:** whenever a card or effect is played or activated, the other player may respond with an Instant, then
   the first player may respond to that, and so on. When both pass, the chain resolves **newest first**.
6. Activated creature effects ("Once per turn: …") are only used in your Main Phases unless the card says
   otherwise. Triggered effects ("When…", "Whenever…", "At the end of…") happen whenever they trigger.
7. **Destroying a spell as it's played (Pipebomb, v4.7):** play it in response to a spell (a chain, 5). That spell
   does nothing and goes to its owner's Waste Repository. It was still played, so it counts for Spellcount (14.8) and
   "whenever you play a spell" effects. Pipebomb can also destroy a spell that's already in play: a Continuous or
   Field Spell, or a Neighborhood Watch.

## 11. Health, damage & destruction

**Player health (PHP).** You start at 30. Restoring can't take you above 30; gaining can.

| Card says | What happens |
|---|---|
| Restore PHP | Heals you, but never above 30 (your starting PHP). |
| Gain PHP | Adds PHP. Can take you above 30. |
| Pay PHP | A cost. Always payable, even if it drops you to 0 (and then you lose). |
| Lose PHP | Any drop: damage, paying, or "lose X PHP". Beelzechud and Beelzechad care about this. |

**Creature HP.** Damage stays on a creature until something restores its HP. Nothing heals by itself.

| Term | Meaning |
|---|---|
| Current HP | The HP it has right now. |
| Max HP | Printed HP + permanent gains − permanent losses. |
| Restore HP | Heal Current HP. Never above Max HP (Radiance turns the extra into a bonus, 14.1), and Max HP doesn't change. |
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

1. In your Battle Phase, each of your creatures can **attack once per turn**, one attack at a time, except on the turn it
   arrived (9).
2. **Choose a target.** An attacker can hit the enemy creature **in front of it** or in **a lane next to it** (the
   middle lane reaches all three enemy lanes).
3. **Direct attacks:** if nothing is in front of it, it may attack the **player** instead. Enemy creatures in the
   lanes next to it hit it back with their ATK, unless they're winded (7).
4. **Response window:** after the attack is declared, the defending player, then the attacking player, may play
   Instants. "When this creature attacks" effects trigger when the attack is declared.
5. **Speed decides who hits first.** Speed runs **1–8**; 4 is normal. **The attacker gets +1 Speed** for its attack
   (attacker's advantage). The faster creature deals its damage first; if they're still tied, **flip a coin** (v4.6).
   If the first hit destroys the other creature, it doesn't hit back. On a direct attack, enemies faster than the
   attacker (counting its +1) hit it before it reaches the player; slower ones hit it after; tied ones flip a coin.
   **Twisted Dimensions** (field spell, both players) reverses speed: the slower creature strikes first and the
   attacker gets −1 Speed instead of +1. Ties are still a coin flip.
6. Damage dealt in combat stays (11).
7. **Winded:** a creature that attacks is **winded** until the start of your next turn, and so is a fusion the turn
   it's made (13). A winded creature **can't hit back when it's attacked**. It still stands in its lane, so an enemy
   in front of it still can't attack you directly, and its effects still work. Attacking is a choice: the creature
   that hits now can't defend itself on your opponent's turn. **Turn a winded creature sideways** to show it, and
   stand it back up at the start of your next turn.
   **Direct attacks (v4.5):** a winded creature in a lane next to an attacker that hits you directly **still hits it
   back**, but always **last**, after the attacker has hit you and after the other creatures hitting back, whatever
   its speed.

## 13. Fusion

Fusions are the end goal: each one is stronger than an Ultra.

- **Once per turn, in Main Phase 1, pay 2 flux to fuse.** Choose **2 creatures you control in lanes next to each
  other**, both with a printed cost of **5 or more flux**, that meet the recipe in {curly brackets} on a fusion in
  your Fusion Deck. **Fusions count as 5+ flux**, so two fusions can be fused too (v4.5).
- Put the two creatures **under** the fusion card. They're now its **fusion splices**, not creatures. Put the fusion
  in either of their lanes; the other lane is free again.
- **Damage carries over (v4.5).** The fusion arrives at its own printed stats, minus the damage its fusion splices
  had: a 4/5 and a 5/10 creature carry 1 + 5 = 6 damage, so a 26 HP fusion arrives at 20/26. If the damage is its HP
  or more, it's destroyed straight away.
- **A new fusion is winded (v4.5).** It can't attack until your next turn (9), and it can't hit back until then
  either (12).
- **Fusion splices under a fusion.** Every card in the stack counts: fuse two fusions that each have 2 splices and the
  new one has 6 (the two fusions and their 4 splices). Fusion effects that say "for each fusion splice under this
  creature" count them all. **Banishing a fusion splice** sends one card from the stack to its owner's Oblivion; you
  can only banish a card that has nothing under it.
- **Ways around the 2 flux:** **It's Free Fuse-Estate** (spell) lets you fuse without paying it. **Crimson Altar**
  (field spell) lets you sacrifice another Unholy creature instead.
- **Cheaper fusion splices:** **Ritual Pit** (continuous spell): banish an Unholy creature from your Waste
  Repository, and your next fusion this turn may use a 3–4 flux Unholy creature as a fusion splice. **Melting Pot**
  (field spell, both players): any creature that meets a recipe can be a fusion splice, whatever it costs.
- **From your hand:** **Shotgun Wedding** (spell) fuses a creature you control with a creature card from your hand.
  The usual recipe, 5+ flux and 2 flux rules apply, and it's your fusion for the turn.
- **Recipes:** a card name means that exact card; an attribute ("any Holy creature") means any creature with it.
  Fusions have attributes too, so they can fill attribute parts.
- **Nothing else carries over:** a fusion only has the effect printed on its own card. Its fusion splices' effects
  and stat changes don't carry over (only their damage does).
- **When a fusion is destroyed**, the fusion card and every card under it go to their owners' Waste Repositories.
  Only the fusion's own death effects trigger.
- **Unfuse (v4.5):** the fusion goes back to its owner's Fusion Deck and the cards directly under it come back onto
  the field at full HP (a fusion splice that is itself a fusion comes back with its own splices under it). Then the
  fusion's damage is **split evenly** between them, half each for the usual two (the bigger one takes an odd point),
  but it never takes one below 1 HP: a 2/30 fusion made of a 10 HP and a 7 HP creature comes back as 1/10 and 1/7.
  If the fusion was winded, they're winded. They've arrived, so they can't attack this turn.
- **Space Squid (v4.6):** pay PHP equal to the enemy creature's printed flux cost (10 for a fusion) and move it to an
  empty lane on your side until the start of your next turn; if it was winded, it isn't any more. Then it goes back to
  its owner's old lane, or another empty one (with no empty lane, to its owner's Waste Repository). Without an empty
  lane of your own you can't play Space Squid.
- **Space Squid and fusing:** a creature you've taken control of can be one of your fusion splices. It stays under your
  fusion until that fusion leaves the field, and then it goes to its owner's Waste Repository (or its owner's side of
  the field, if the fusion is unfused).

## 14. Keywords

### 14.1 Radiance
A creature with **Radiance** never wastes healing. When HP restored to it would go past its Max HP, the extra becomes
**your choice** of that much **+ATK** or that much **+HP** over max (overhealth), **until your next turn**. Max HP
doesn't change; the bonus ends at the start of your next turn.
Example: a Cherub (Radiance) at 2/2 is restored by 2: choose +2 ATK, or 4/2 HP, until your next turn. (Giving HP is
different: it's permanent and raises Max HP, see 11.)
Card text: "Radiance (when this creature is restored past its max HP, it gains your choice of +ATK or +HP equal to the
extra, until your next turn)."

### 14.2 Blood Price
Card text: **"Pay 3 PHP per flux: Reduce this creature's flux cost by up to Y."** (with Y = 1 just "Pay 3 PHP: Reduce
this creature's flux cost by 1."). Only when you naturally materialize the creature (from your hand): take any amount
off its flux cost, up to Y, paying **3 PHP for each flux**. Example: Vein Ripper (3 flux, up to 2) can be played for
3 flux, 2 flux + 3 PHP, or 1 flux + 6 PHP. The printed cost still decides tier and fusion eligibility. Paying PHP is what lets
you play them early.

### 14.3 Dice ATK & Gold
- **Dice ATK:** an ATK like "1+d6" is **rolled every time the creature attacks**, for that attack only. When it hits
  back in a fight, it rolls too. "Natural 20" / "natural 1" means the die itself showed that number.
- **Gold:** everyone starts with **0 Gold**; there's **no cap**. Only cards that mention Gold can make, spend or move
  it. Invested Gold is locked into that card and lost if the card leaves the field.
- The v2.1 **Market Cycle** is no longer a rule.

### 14.4 Fluffy & the Claw Machine (Plushies)
- **Fluffy** creatures (plushies) can only be materialized, by any means, while you control a **Claw Machine** (Field
  Spell). Card text: "(you can only materialize this creature while you control a Claw Machine)."
- **Claw Machine (v4.6)** does only that. Losing it doesn't hurt the plushies already on the field; you just can't
  materialize more until you have one again. (Until v4.6 it also gave a discount, let plushies slip past blockers and
  drew a card when one died, and plushies were destroyed without it.)
- **Plush Cherub (v4.6):** whenever another Fluffy creature you control dies, draw a card.
- Plush cards are plush versions of existing creatures: they keep the original's attributes (so they fit its
  faction's recipes) and add **Fluffy**. Arcade Kid and Plush Collector aren't Fluffy; they search for the Claw
  Machine. Plush Catalogue searches for any card with "Plush" in its name, including more Plush Catalogues.

### 14.5 Fossil & Stampede (Dinos, v4.7)
- **Fossil X:** "you may materialize this creature from your Waste Repository by banishing X other cards from your Waste
  Repository instead of paying its flux cost." It's a natural materialize: Main Phase 1, an empty lane, "when
  materialized" triggers, and the creature has arrived (it can't attack this turn). It can't be combined with Blood
  Price. The banished cards go to Oblivion, so every Fossil burns some of the fuel for the next one.
- **"When materialized from your Waste Repository"** (Pteranodon, T-Rex) triggers on Fossil, Archaeologist, TT-rex and
  Microwave alike.
- **Milling:** "put the top cards of your deck into your Waste Repository" (Compsognathus, Archaeologist, Primordial Soup)
  fills your Waste Repository on purpose. Milling an empty deck does nothing; drawing from one still costs 5 PHP.
- **Stampede:** "when this creature destroys a creature in combat, the leftover damage hits your opponent." Leftover
  = the hit minus the HP the creature had left. It works on hits back too, and a creature that survives (Chapel Guard,
  Seraphim Wall) leaves nothing over.
- In the battle sim Dino decks were too strong at first (the best pure-Dino build won 87% against the playtest decks);
  trimming the bigger Dinos' stats brought the two starters to about 51% (Jurassic Junkyard) and 56% (Bone Yard).

### 14.6 Complaints (Mundane, v4.7)
- **Complaint:** a counter on a creature (use a coin or a die). Each one gives it **−2 ATK**, and while it has any its
  **"once per turn" effects don't work**. Complaints stack. Card text: "(Complaint: the creature has -2 ATK for each
  one and its 'once per turn' effects don't work. Its controller may pay a 3 flux fine in their Main Phase to remove one.)"
- **Fines:** in your Main Phase you may pay **3 flux** to remove one Complaint from a creature you control, as often as
  you can pay. HOA President makes fines cost its opponent 1 more. Jonnhy '5 inches' pays out whenever you pay one.
- Complaints stay when a creature changes sides (Space Squid) and go away when it leaves the field.
- **Mall Cop Gary:** enemy creatures with a Complaint can't attack. **Neighborhood Watch** is a Spell that stays in its
  spell zone for your opponent's next 2 turns. Pipebomb can destroy it there.
- **Purrramid** {Cat + Cat} can be made from creatures of any flux cost, an exception to the 5+ flux rule (13).

### 14.7 Descend (Angels, v4.7)
- **Descend:** "when an enemy creature attacks, you may materialize this creature from your hand by paying its flux
  cost; the attack hits this creature instead." Do it after the attack is declared and its "when this creature
  attacks" effects resolve. Put it in any empty lane; the attacker fights it, whatever lane it's in, whether it was
  attacking a creature or you directly.
- You pay with the flux you have left. **Flux isn't refilled until your Reactor Phase**, so flux you don't spend on
  your turn is there for a Descend on your opponent's turn.
- It's a materialize: "when materialized" effects trigger. It arrived on your opponent's turn, so it can attack on
  yours. It isn't winded, so it hits back as normal. "When this creature Descends" effects (Judicator Angel, Gabe)
  happen before the fight.
- Bellkeeper Monk and Sanctuary Bells each make your Descends cost 1 less flux. Fusions can't Descend.

### 14.8 Spellcount (Wizards, v4.7)
- **Spellcount:** the number of spells you've played this turn, including Instants on your opponent's turn. A spell
  counts itself, so the third spell you play sees Spellcount 3. Track it with a die; it goes back to 0 at the end of
  every turn. A negated spell still counts.
- "Spellcount 3+: …" means the bonus applies when your Spellcount is 3 or more as the card resolves.
- **One-shot spell:** a Spell or Instant Spell (not a Continuous or Field Spell). **The Archmage:** the first one-shot
  spell you play each turn resolves twice (costs aren't paid again). **Déjà Vu** plays a one-shot spell from your Waste
  Repository as if it were in your hand, then banishes it.
- **Polymorph:** the creature is a Frog with 1 ATK and no effects until the end of your next turn. Its HP doesn't
  change, and damage it takes as a Frog stays when it turns back. A Frog has exactly 1 ATK, so Complaints don't lower
  it (they're still there when it turns back).
- **Abracadabra:** the creature goes back to its owner's hand as a new card: its damage, Complaints and fusion stack
  are gone, and it has to be materialized again (paying its flux). A creature you took with Space Squid goes back to
  its owner's hand, not yours.
- **Card Trick:** you see your opponent's whole hand, then pick one card. Below Spellcount 3 they shuffle it into
  their deck; at Spellcount 3+ it goes to their Waste Repository.
- **Spelling Mistake:** take the ATK and HP the creature has right now (Complaints and other changes included) and
  swap them: the old ATK is its new HP and max HP, and the old HP is its new ATK. Effects that are still going
  (a Complaint, +ATK until end of turn) keep applying afterwards. A creature with 0 ATK is destroyed. On a Frog, the
  HP becomes 1 (a Frog has 1 ATK), and once it turns back its ATK is the HP it had.
- **Wild Magic:** a 6 rolls twice more; a 6 on those rolls again too. At Spellcount 3+ you roll two dice, pick one
  result and ignore the other. Loaded Dice can reroll any of the dice. "Oops" picks your highest-ATK creature (you
  choose on a tie) and does nothing if you have none.
- **Extra Credit:** the creature can make a second attack in the same Battle Phase, after its first (it's winded
  after the first, as normal). Creatures that can't attack this turn still can't.

## 15. Advanced rules

1. **Forgotten effects:** a forgotten optional effect ("may") is gone. A forgotten mandatory one is resolved if it's
   caught the same turn.
2. **Reading card text:** "at the start/end of your turn" = your own turn only; "each turn" / "every turn" = both
   players' turns; "until end of turn" wears off at the end of the current End Phase; "any creature" = either side;
   "enemy creature" = one your opponent controls. Halves round down.
3. **Negate:** the creature has no card text until the negation ends. Its stats, name and attributes stay.
4. **Owner & controller:** cards always go to their *owner's* hand, deck, Waste Repository or Oblivion.
5. **Hand limit:** 8, checked at the end of every turn.
6. **Searching your deck:** shuffle afterwards and offer the cut.
7. **Once per turn / once per game:** counted per effect name, so 3 copies of a card still get one activation.
8. **Targeting:** an effect targets when it chooses a specific card. Attacking isn't targeting for "untargetable".
9. **Simultaneous effects:** the player whose turn it is resolves theirs first, in the order they choose.

## 16. Quick reference

| | |
|---|---|
| Starting PHP | 30. Restoring can't take you above 30; gaining can |
| Main Deck / Fusion Deck | 30 / up to 10, max 3 copies |
| Opening hand | 5. One free redraw if it has 0–1 creatures; mulligan only if both agree |
| Arriving | Creatures and fusions can't attack the turn they arrive |
| Draw per turn | 1 (first player skips their first) |
| Flux | starts 3, +1 a turn, max 10. Second player +1 on their first turn |
| Reactor Phase | +1 max flux and refill; or also Feed (a card to Oblivion: +1 flux this turn); or Skip (no +1, draw 1) |
| Lanes / spell zones / field spells | 3 / 3 / 1 per player |
| Speed | 1–8, 4 is normal. The attacker gets +1, faster strikes first, a tie is a coin flip |
| Winded | Turn it sideways. A creature that attacked, or a fusion just made, can't hit back when attacked until your next turn. On a direct attack it still hits back, last |
| Fusing | once per turn, 2 flux, two 5+ flux creatures (or fusions) in lanes next to each other. The fusion keeps their damage and is winded |
| Unfuse | the splices come back at full HP and split the fusion's damage, never below 1 HP |
| Empty deck | lose 5 PHP for each draw you can't make |
| Hand limit | 8 |
| Complaint | −2 ATK each, no "once per turn" effects. Pay a 3 flux fine in your Main Phase to remove one |
| Descend | On your opponent's turn, when an enemy attacks: materialize it from your hand with leftover flux; the attack hits it |
| Spellcount | Spells you've played this turn, counting the one being played |

## Designer notes

**Factions are internal.** Angel, Blood Demon and Goblin are names for designing the game and for the starter deck
boxes; players never need them. Card text never names a faction: it names the attribute instead (**Holy** for
Angels, **Unholy** for Blood Demons, **Greedy** for Goblins, **Fluffy** for Plushies, **Prehistoric** for Dinos,
**Ordinary** for Mundane, **Arcane** for Wizards). Rules terms: a fusion is made
of **fusion splices**.

**Plushies (v4.5)** are modelled on Yu-Gi-Oh!'s Toons: one Field Spell holds the whole deck up (the risk), searching
makes it consistent (Arcade Kid, Plush Collector, Plush Catalogue), and evasive direct attacks make it annoying to
play against. Pipebomb and Space Squid are the natural counters. Plush versions use their originals' stats; the
Claw Machine discount and evasion paid for the dependency until v4.6, when the playtest cut the Claw Machine down to an enabler. Patchwork Plush scales with the Fluffy creatures in your
Waste Repository, so losing plushies feeds it. In the battle sim (4,000-game runs) Plushy decks won 46–50% and the
Plushy starter deck 49–52% against random decks. First drafts were much weaker (22%): the plushies had lower stats than
the originals and the creature in front hit them back when they slipped past.

**v4.7 factions.** Archetypes the game didn't have yet, from Magic, Pokémon, Yu-Gi-Oh! and Weiß Schwarz: **Mundane** is
Magic's taxes plus Pokémon's status conditions (Complaints), **Wizards** are Magic's spellslingers (free spells, so
the payoffs count spells: Spell Slinger burns 1 per spell, Battlemage grows), and **Descend** is Magic's flash and Weiß
Schwarz's backup, so Angels now decide every turn whether to spend their flux or hold it as a threat. In the battle sim
the first drafts were weak (Mundane 21%, Wizards 28% against the six playtest decks): Mundane creatures got +1 ATK and
+2 HP and the fine went from 2 to 3 flux (52–54%); Spell Slinger went from "3 damage at Spellcount 3" to 1 damage to
the opponent for every spell (51–56%). Wizard draws are optional ("may") so the deck doesn't run itself out. Abracadabra
and Card Trick first drew cards and were weaker than Jar of Materialism, so the Wizard spells were redone so that each
one does a different job (bounce, hand disruption, burn, recursion, Frogs, an ATK/HP swap, a d6 of chaos, a second
attack). Night School wins about 55%; with a Jar of Materialism instead of a Wild Magic it would be about 62%, so Wild
Magic is the chaos pick, not the strong one. Angels with Descend win about 61% (51% with the same deck and no Descend); Fallen Grace and
Holy Hustle barely changed.

**Stat budget.** points = ATK + HP ÷ 2 + (Speed − 4) ÷ 2 + effect, aiming for **2 × flux + 1** (about 20 for Ultras) and
**28 for fusions**. Two 5-flux creatures are worth 22, so a fusion pays them back plus the fuse.

- **Blood Price creatures** used to aim 1–2 points under budget. Since v4.4 they aim for the full budget: in the
  battle sim Blood Demons fell far behind otherwise.
- Dice count at their average (a d6 is 3.5).
- Speed steps count double on creatures with 8+ ATK.
- Effects: small ≈ 1, repeatable 2–3, removal or an engine 4+.
- Cards costing 1–3 may be up to 1 point over.
- Cost tiers per faction: 8 creatures in a 2 : 3 : 2 : 1 spread (Low 1–3, Medium 4–5, High 6–8, Ultra 9–10).

**Fusion splices (v4.5).** Every fusion does something with the cards under it, one of two ways: **banish a fusion
splice** for a burst (heal, destroy, survive, dodge a drawback), or **count the fusion splices** for a scaling effect
(dice, damage, gold, healing). A normal fusion has 2, so write the effect so that 2 is its fair power; fusing fusions
(6 or more) is the payoff for building a stack. Banishing trades away scaling and what Unfuse gives back, so the burst
should be worth about a card. A fusion that can fuse into another copy of itself (Scrooger) grows its stack that way too.

**Checking balance.** The card editor's **Battle sim** tab (`tools/battle-sim.js`) plays thousands of games between random
decks and the saved decks, shows which cards and fusions win too much, and tests luck vs skill. Its "Rules to try" can
switch back to the v4.2 / v4.3 rules to compare.
