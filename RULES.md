# Fusion Fuckery: Rulebook v4.7 (gameplay v2)

Decided on 2026-10-19. This replaces the Rulebook v2.1 (*The Blocking Update*) wherever the two disagree; everything
v2.1 says that isn't covered here still applies. The Mutant, Parasite, Bleed and Equipment rules are only in v2.1,
because those cards are in cold storage (the Dinos came back in v4.7 with new rules, 14.5; the Mundane cards came back in v4.7, 14.6, and went back into cold storage on 2026-11-16). The player-facing version with diagrams is
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
gives +2 Speed; Twisted Dimensions' text now says a tie is still a coin flip (the v4.6 rule). **Card audit:**
Abracadabra and Extra Credit can only be played at Spellcount 3+; a Polymorph Frog turns back with the HP it had
before; Wild Magic is gone; Wizard Tower banishes a fusion splice to return a spell (it used to return one every
turn); Blood Ledger searches your deck for an Unholy creature (it used to draw); Big Fireball hits any creature but not
players; Community College of Magic gives 1 flux (it used to give a card); Lord Lazarus comes back with 2 Speed
(half of 4); Jonnhy '5 inches' is now Johnny '5 inches'. Nuclear Waste is back from cold storage with new text (10.8)
and Crack a pack with its own. **Five new fusions** have attribute recipes, so creatures from different factions can
fuse (13): Chimera, Blood Mage, The Flock, Fossil Fuel Baron and Absolute Unit. Night School Professor now destroys a
Frog to cast Frog Bolt (14.8), and Chimera is Winged and a triple fusion (13). New starter decks:
Jurassic Junkyard, Bone Yard, Red Tape and Night School. Four plushies are now plush versions of other
factions' creatures, with the same stats and effects and their new originals' attributes: Plush T-Rex, Plush Mall Cop
Gary, Plush Spell Slinger and Plush Salem (were Plush Judicator Angel, Plush Dark Duchess, Plush Vein Ripper and Plush
Sanctified Knight). Without Holy and Noble plushies, the Haunted Arcade and Toy Box starters swap Fallen Angel and Lord
Lazarus for Necrosaurus and a third Mega Plush. Blood Frenzy is now Blood Demon Cigarettes, with the same
effect. The v4.6 cards, decks and rulebook are saved under the git tag
`save-before-v4.7` and in `saves/versions/` ("SAVE before v4.7 rules").

**2026-11-16:** **Mundane is back in cold storage**, all 17 cards, so the Red Tape starter deck is out of play too (14.6 stays
for when it returns). **Plush Mall Cop Gary is now Plush Sanctified Knight**, with the same stats and effect and Sanctified
Knight's attributes (Holy / Humanoid / Noble / Fluffy).

**2026-11-26: balance patch.** Rules: **Radiance** only works the first time each turn a creature is restored past
its max HP (14.1). **Descend** costs half the flux, rounded up, and the creature arrives winded, so it doesn't hit back
(14.7); Cherub and Acolyte Adam now have it. **Fossil** works once per turn per card name (14.5). **"Once per turn"**
is now printed as "You can only use this effect of [card] once per turn" (15.7), Blood Price included (14.2), and
one-shot spells say "You can only play 1 [card] per turn". **Melting Pot** has Ritual Pit's effect for any creature
(13); Ritual Pit is in cold storage, and Melting Pot replaces it in the Fallen Grace and Bone Yard starters. Nerfs:
Indulgence Seller (HP equal to the gold, a fusion splice counts as 2 gold), Ergof The Dark Emperor (4 PHP for 5 HP or
less, a fusion splice for 8 HP or less), Renroc The Dark Marquis (3 PHP), Archaeologist (mills 2), Market Research
(2 gold), Goblin Shuffle (no extra card), Jar of Materialism (draw 1, your opponent gains 4 PHP), Patchwork Plush
(10 flux), Microwave and Shotgun Wedding (1 per turn). Reworks: **Lord Lazarus** 3/12, Speed 2, +3 ATK, +5 HP and
+1 Speed per fusion splice, and once per turn it takes a Noble creature from your Waste Repository as a new fusion
splice; **Fallen Angel** has no effect and 24 HP; **Fossil Record** puts up to 2 Prehistoric creatures from your
deck into your Waste Repository; **Card Trick** shuffles a random card from your opponent's hand into their deck and
they draw a new one; **Shotgun Wedding** materializes a fusion from your hand or field that can attack straight away
(but not you directly) and is destroyed at the end of the turn; **Crack a pack** opens a new sealed pack, 1 card to
your hand and the rest banished; **Loaded Dice** chooses the result, without side effects; **Arcade Kid** also counts
the Fluffy creatures in your Waste Repository, and each one makes it cost 1 more flux (up to 10); **Goblin Pit Boss**
rerolls as the die is rolled (it used to be a Main Phase effect, when no die is being rolled). Smaller changes:
Ankylosaurus reduces any damage, Pocket Fireball can hit a player, Energy Drink can't trigger Radiance, Pipebomb
negates the spell as well, Overclock can't feed itself, Plush Catalogue can't find another Plush Catalogue, Unfuse
lets the fusion's owner choose which fusion splices go to the Waste Repository when there's no room, a Space Squid'd
fusion's fusion splices are yours too, Gabe is 8/16 and Judicator Angel 6/12, and Beelzechud, Carrion The Dark
Duchess and Nomed The Dark Viscount are Winged. The cards, decks and rulebook from before are in `saves/versions/`
("SAVE before balance patch 2026-11-26").

**2026-11-27:** **Face-down spells** (10.9): like Yu-Gi-Oh!, you can set a spell face down in your Main Phase and
play it later, on your opponent's turn too. **Unfuse** now materializes the fusion splices, so their "when
materialized" effects trigger. **Déjà Vu** works once per game. **Boss's Orders is now You're FIRED!**: 1 damage to a
creature, and it loses 2 Speed. **Arriving:** creatures can attack the turn they're
materialized; only fusions (winded) wait a turn. **Speed:** no more +1 Speed for the attacker; on a speed tie the attacker strikes
first (it was a coin flip). Twisted Dimensions says the same. **Plushies reworked** (14.4): a plushy materialized with
no Claw Machine on the field is destroyed (it used to be impossible to materialize one); Claw Machine now rolls a d6
once per turn and on a 6 brings a Fluffy creature back from your Waste Repository; Arcade Kid only searches for the
Claw Machine; new death effects on Plush Salem (draw 1, then discard 1), Plush Sanctified Knight (1 damage to the
creatures next to it) and Plush T-Rex (3 damage to the enemy in front of it, and it still returns a Fluffy creature to your hand at the end of your turn); Patchwork Plush gets +2 ATK and +2 HP
for each Fluffy creature on the field and in your Waste Repository, and still gets cheaper. **Salem and Plush Salem are Noble** (so they fit Lord Lazarus's recipe). **Removal:** **Ritual Pit** is back as a Spell: destroy a creature, and
its controller draws 1 card. **Goblin General** is now Hostile Takeover: once per turn, pay gold equal to a creature's
current HP to destroy it (its old effects are gone). **Gob-omber**'s blast deals double damage to creatures that cost
6 or more flux and to fusions. **Shotgun Wedding** needs at least one fusion splice from your field. **Underdog** (14.9): a few cheap
creatures deal 2 more combat damage to fusions. **The Flock is now The Feeble Fusion** (13): 2 or 3
creatures of any flux cost whose flux adds up to 7 or more, 6/16, with **Execute** (14.9). All saved decks, the starter decks included, were removed (the old ones are in
`saves/versions/`).

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
| 5 | Battle | Attack (12). Nobody attacks on the first turn of the game, and fusions made this turn can't attack. |
| 6 | Main 2 | Spells and effects. No natural materializing and no fusing. |
| 7 | End | End-of-turn effects → discard down to 8 cards. |

## 9. Materializing creatures

- **Natural materialize:** in Main Phase 1, from your hand. Pay its flux cost (some creatures let you pay part of it
  in PHP with **Blood Price**, 14.2), then put it in any empty lane. No limit beyond flux and lanes.
- **By effect** (Carrion The Dark Duchess, Claw Machine…): happens whenever the effect says, without paying flux. It
  still needs an empty lane.
- "When materialized" effects trigger both ways.
- **Only fusions can't attack the turn they arrive (2026-11-27).** A creature can attack the turn it's materialized or
  brought back. A fusion arrives winded (13), so it waits until your next turn, and so do creatures that come back
  winded from Unfuse. (From v4.3 until 2026-11-27 no creature could attack the turn it arrived.) Nobody attacks on the
  first turn of the game.

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
6. Activated creature effects (a cost and a colon, "You may …", or anything with "You can only use this effect of …
   once per turn") are only used in your Main Phases unless the card says otherwise. Triggered effects ("When…", "Whenever…", "At the end of…") happen whenever they trigger.
7. **Destroying a spell as it's played (Pipebomb, v4.7):** play it in response to a spell (a chain, 5). That spell
   does nothing and goes to its owner's Waste Repository. It was still played, so it counts for Spellcount (14.8) and
   "whenever you play a spell" effects. Pipebomb can also destroy a spell that's already in play: a Continuous or
   Field Spell, or a Neighborhood Watch.
8. **Nuclear Waste (v4.7)** rolls for one of your creatures at random at the end of your turn. A creature it destroys
   was destroyed, so its "when destroyed" effects trigger.
9. **Face-down spells (2026-11-27, like Yu-Gi-Oh!):** in your Main Phase, instead of playing a Spell, Instant Spell or
   Continuous Spell from your hand, you may **set** it face down in an empty spell zone (Field Spells can't be set).
   It takes up that zone, and your opponent only sees that a card is there.
   - **Not the turn you set it.** From your opponent's next turn on, you may flip it face up and play it whenever
     you could play an Instant: on your opponent's turn, during combat, in response to a card or effect, or in your
     own Main Phases. So a set Spell can be played on your opponent's turn too.
   - It's played when it's flipped: it counts for Spellcount and "whenever you play a spell" then, its conditions
     ("Spellcount 3+ only", "You can only play 1 … per turn") are checked then, and any cost is paid then.
   - Pipebomb can destroy a face-down spell. It goes to its owner's Waste Repository without doing anything.
   - You don't have to play it; it stays until you do or something removes it.
10. **Losing Speed (You're FIRED!, 2026-11-27):** permanent, but Speed never goes below 1.

## 11. Health, damage & destruction

**Ritual Pit (Spell, 2026-11-27):** destroy any creature, fusions included; the creature's controller draws 1 card.
Chapel Guard and Seraphim Wall can still save it, as with any "destroy".


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

1. In your Battle Phase, each of your creatures can **attack once per turn**, one attack at a time. A fusion can't attack
   the turn it's made (9).
2. **Choose a target.** An attacker can hit the enemy creature **in front of it** or in **a lane next to it** (the
   middle lane reaches all three enemy lanes).
3. **Direct attacks:** if nothing is in front of it, it may attack the **player** instead. Enemy creatures in the
   lanes next to it hit it back with their ATK, unless they're winded (7).
4. **Response window:** after the attack is declared, the defending player, then the attacking player, may play
   Instants. "When this creature attacks" effects trigger when the attack is declared.
5. **Speed decides who hits first.** Speed runs **1–8**; 4 is normal. The faster creature deals its damage first.
   **On a tie, the attacker strikes first (2026-11-27).** (From v4.6 the attacker got +1 Speed for its attack and a
   tie was a coin flip; there's no attacker's +1 any more.)
   If the first hit destroys the other creature, it doesn't hit back. On a direct attack, enemies faster than the
   attacker hit it before it reaches the player; slower and tied ones hit it after.
   **Twisted Dimensions** (field spell, both players) reverses speed: the slower creature strikes first, and
   a tie still goes to the attacker.
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
- **Adding fusion splices (Lord Lazarus, 2026-11-26):** once per turn, Lord Lazarus puts a Noble creature from your
  Waste Repository under itself as a new fusion splice. It brings no damage with it, and Lord Lazarus gets its
  +3 ATK, +5 HP and +1 Speed for it straight away (its current HP goes up by 5 too). Banishing a fusion splice from
  under it takes those away again, and if that drops it to 0 HP it's destroyed.
- **Ways around the 2 flux:** **It's Free Fuse-Estate** (spell) lets you fuse without paying it. **Crimson Altar**
  (field spell) lets you sacrifice another Unholy creature instead.
- **Cheaper fusion splices:** **Melting Pot** (field spell, since 2026-11-26): once per turn, banish a creature from
  your Waste Repository, and your next fusion this turn may use a creature that costs 3 or 4 flux as one of its fusion
  splices. Only Melting Pot's owner can use it. (It used to let both players fuse creatures of any cost. Ritual Pit,
  which did this for Unholy creatures only, went into cold storage; it came back on 2026-11-27 as a removal Spell.)
- **Shotgun Wedding (2026-11-26):** materialize a fusion from your Fusion Deck, its fusion splices taken from your field and
  your hand, with **at least one from your field** (2026-11-27). They have to meet its recipe and the 5+ flux rule, as normal. It isn't fusing: it doesn't cost
  the 2 flux and doesn't use up your fusion for the turn. The fusion goes in the lane of one of its splices from the field. It isn't winded and **can attack this turn**, but not your opponent directly. At the
  end of your turn it's destroyed, with its fusion splices (death effects trigger). Only 1
  Shotgun Wedding per turn.
- **Recipes:** a card name means that exact card; an attribute ("any Holy creature") means any creature with it.
  Fusions have attributes too, so they can fill attribute parts.
- **Cross-faction fusions (v4.7):** recipes that only ask for attributes, so different factions can fuse together.
  **Chimera** {any 3 Beast creatures} is a **triple fusion**: three Beasts, one in each of your lanes and of any
  flux cost, fuse into it for the usual 2 flux. It takes the middle lane and frees the other two; damage from all three
  carries over, and Unfuse brings all three back where there's room. **Blood Mage**
  {any Arcane creature + any Unholy creature}. **The Feeble Fusion** (2026-11-27, was The Flock) {any 2 or 3 creatures}: 2 or 3 of
  your creatures in lanes next to each other, of **any flux cost**, as long as their printed flux costs add up to
  **7 or more** (a fusion counts as 5); with 3 it takes the middle lane, like Chimera. It's 6/16 with Execute (14.9). **Fossil Fuel Baron** {any
  Prehistoric creature + any Greedy creature} gains 1 gold for every card banished from your Waste Repository (a
  Fossil cost, Night School Professor, Salem…). **Absolute Unit** {any 2 Heavy fusions} needs two fusions next to
  each other; every card in both stacks becomes its fusion splice.
- **Nothing else carries over:** a fusion only has the effect printed on its own card. Its fusion splices' effects
  and stat changes don't carry over (only their damage does).
- **When a fusion is destroyed**, the fusion card and every card under it go to their owners' Waste Repositories.
  Only the fusion's own death effects trigger.
- **Unfuse (v4.5):** the fusion goes back to its owner's Fusion Deck and the cards directly under it come back onto
  the field at full HP (a fusion splice that is itself a fusion comes back with its own splices under it). Then the
  fusion's damage is **split evenly** between them, half each for the usual two (the bigger one takes an odd point),
  but it never takes one below 1 HP: a 2/30 fusion made of a 10 HP and a 7 HP creature comes back as 1/10 and 1/7.
  If the fusion was winded, they're winded and can't attack this turn; otherwise they can. **Since 2026-11-27
  they're materialized** (from the fusion onto the field), so their "when materialized" effects trigger. They come back in the
  fusion's lane and your empty lanes; if there isn't room for all of them, the **fusion's owner** chooses which go to
  the Waste Repository instead (2026-11-26).
- **Space Squid (v4.6):** pay PHP equal to the enemy creature's printed flux cost (10 for a fusion) and move it to an
  empty lane on your side until the start of your next turn; if it was winded, it isn't any more. Then it goes back to
  its owner's old lane, or another empty one (with no empty lane, to its owner's Waste Repository). Without an empty
  lane of your own you can't play Space Squid. **A fusion's fusion splices are yours too (2026-11-26):** while you
  control the fusion you can banish them for its effects (they go to their owner's Oblivion).
- **Space Squid and fusing:** a creature you've taken control of can be one of your fusion splices. It stays under your
  fusion until that fusion leaves the field, and then it goes to its owner's Waste Repository (or its owner's side of
  the field, if the fusion is unfused).

## 14. Keywords

### 14.1 Radiance
A creature with **Radiance** never wastes healing. When HP restored to it would go past its Max HP, the extra becomes
**your choice** of that much **+ATK** or that much **+HP** over max (overhealth), **until your next turn**. Max HP
doesn't change; the bonus ends at the start of your next turn.
**Only the first time each turn (2026-11-26):** after a creature's first Radiance bonus in a turn (yours or your
opponent's), later restores that turn stop at its Max HP as normal. Other creatures with Radiance still get their own
first one. Before, every restore past max added to the bonus, and a few heals in a row could win the game in one attack.
Example: a Cherub (Radiance) at 2/2 is restored by 2: choose +2 ATK, or 4/2 HP, until your next turn. Restore it again
that turn and nothing more happens. (Giving HP is different: it's permanent and raises Max HP, see 11.)
Energy Drink's restore never triggers Radiance.
Card text: "Radiance (the first time each turn this creature is restored past its max HP, it gains your choice of +ATK
or +HP equal to the extra, until your next turn)."

### 14.2 Blood Price
Card text: **"Pay 3 PHP per flux: Reduce this creature's flux cost by up to Y. You can only use this effect of [card]
once per turn."** (with Y = 1 just "Pay 3 PHP: Reduce this creature's flux cost by 1. …"). Only when you naturally
materialize the creature (from your hand): take any amount off its flux cost, up to Y, paying **3 PHP for each flux**.
**Once per turn per card name (2026-11-26):** it can't be used again to take off more, and a second copy of the same
creature that turn costs full flux. Example: Vein Ripper (3 flux, up to 2) can be played for
3 flux, 2 flux + 3 PHP, or 1 flux + 6 PHP. The printed cost still decides tier and fusion eligibility. Paying PHP is what lets
you play them early.

### 14.3 Dice ATK & Gold
- **Dice ATK:** an ATK like "1+d6" is **rolled every time the creature attacks**, for that attack only. When it hits
  back in a fight, it rolls too. "Natural 20" / "natural 1" means the die itself showed that number.
- **Hostile Takeover (Goblin General, 2026-11-27):** once per turn, in your Main Phase, pay gold equal to a
  creature's current HP (any creature, fusions included) to destroy it. A 20/26 fusion costs 20 gold.
- **Gob-omber (2026-11-27):** its blast hits every creature, both sides, for the gold paid; creatures that cost 6 or
  more flux and all fusions take twice that.
- **Goblin Pit Boss (2026-11-26):** its reroll is a trigger, used the moment a Greedy creature you control rolls its
  die (in a fight, too): pay 1 gold, roll again and use the new result. Once per turn. (It used to be a Main Phase
  effect, and no die ATK is rolled in a Main Phase, so it could never be used.)
- **Loaded Dice (2026-11-26):** you pick the number (or heads/tails) and it's used as the result, but it doesn't
  trigger side effects: no Natural 20 or Natural 1 bonus, no Goblin Pit Boss gold for the highest number. What the
  roll is for still happens: a die ATK uses the number, Nuclear Waste uses its table, Primordial Soup's 1 still destroys.
- **Gold:** everyone starts with **0 Gold**; there's **no cap**. Only cards that mention Gold can make, spend or move
  it. Invested Gold is locked into that card and lost if the card leaves the field.
- The v2.1 **Market Cycle** is no longer a rule.

### 14.4 Fluffy & the Claw Machine (Plushies)
- **Fluffy** creatures (plushies) can be materialized any time, by any means, but **if one is materialized while no
  Claw Machine is on the field, it's destroyed** straight away, so its "when materialized" and death effects both
  trigger (2026-11-27). Any Claw Machine counts, yours or your opponent's. Card text: "(If this creature is
  materialized without a Claw Machine on the field, it's destroyed.)" Losing the Claw Machine later doesn't hurt the
  plushies already on the field. (From v4.6 until 2026-11-27 a plushy couldn't be materialized at all without your
  Claw Machine.)
- **Claw Machine (Field Spell, 2026-11-27):** once per turn, in your Main Phase, roll a d6. On a 6 you may materialize
  a Fluffy creature from your Waste Repository (into an empty lane).
- **Plush Collector** says "even if you don't control a Claw Machine", so a plushy it materializes isn't destroyed
  (the card wins).
- **Plush death effects (2026-11-27):** Plush Salem: draw 1 card, then discard 1. Plush Sanctified Knight: 1 damage to
  the creatures in the lanes next to it, on its own side. Plush T-Rex: 3 damage to the enemy creature in front of it (and it keeps its end-of-turn effect: return a Fluffy
  creature from your Waste Repository to your hand).
  All of them trigger when a plushy is destroyed for having no Claw Machine.
- **Plush Cherub (v4.6):** whenever another Fluffy creature you control dies, draw a card.
- Plush cards are plush versions of existing creatures: they keep the original's attributes (so they fit its
  faction's recipes) and add **Fluffy**. Arcade Kid and Plush Collector aren't Fluffy. Arcade Kid searches for the Claw
  Machine. Plush Catalogue searches for any card with "Plush" in its name except another Plush Catalogue (2026-11-26).
- **Arcade Kid (2026-11-27):** just searches for the Claw Machine (its stat bonus and cost increase are gone).
- **Patchwork Plush (2026-11-27):** +2 ATK and +2 HP for each Fluffy creature on the field (both sides) and in your
  Waste Repository, counting itself, and it costs 1 less flux for each Fluffy creature in your Waste Repository (not
  below 0).

### 14.5 Fossil & Stampede (Dinos, v4.7)
- **Fossil X:** "you may materialize this creature from your Waste Repository by banishing X other cards from your Waste
  Repository instead of paying its flux cost." It's a natural materialize: Main Phase 1, an empty lane, "when
  materialized" triggers, and since 2026-11-27 it can attack this turn. It can't be combined with Blood
  Price. The banished cards go to Oblivion, so every Fossil burns some of the fuel for the next one.
- **Once per turn per card name (2026-11-26):** "You can only Fossil T-Rex once per turn" means one T-Rex a turn by
  Fossil, whichever copy. Archaeologist pays a Fossil cost, so it counts. TT-rex and Microwave don't use Fossil, so they
  don't. Different Prehistoric creatures can each be Fossiled in the same turn.
- **Ankylosaurus (2026-11-26):** the first damage it takes each turn, from combat or an effect, is 2 less.
- **Fossil Record (2026-11-26):** puts up to 2 Prehistoric creatures from your deck into your Waste Repository, ready to
  Fossil. (It used to return them to your hand, which is worse than leaving them there.)
- **"When materialized from your Waste Repository"** (Pteranodon, T-Rex) triggers on Fossil, Archaeologist, TT-rex and
  Microwave alike.
- **Milling:** "put the top cards of your deck into your Waste Repository" (Compsognathus, Archaeologist, Primordial Soup)
  fills your Waste Repository on purpose. Milling an empty deck does nothing; drawing from one still costs 5 PHP.
- **Stampede:** "when this creature destroys a creature in combat, the leftover damage hits your opponent." (Since
  2026-11-24, T-Rex, TT-rex, Triceratops and Brontosaurus print it in full instead of naming the keyword.) Leftover
  = the hit minus the HP the creature had left. It works on hits back too, and a creature that survives (Chapel Guard,
  Seraphim Wall) leaves nothing over.
- In the battle sim Dino decks were too strong at first (the best pure-Dino build won 87% against the playtest decks);
  trimming the bigger Dinos' stats brought the two starters to about 51% (Jurassic Junkyard) and 56% (Bone Yard).

### 14.6 Complaints (Mundane, v4.7; in cold storage since 2026-11-16)
- **Complaint:** a counter on a creature (use a coin or a die). Each one gives it **−2 ATK**, and while it has any its
  **"once per turn" effects don't work**. Complaints stack. Card text: "(Complaint: the creature has -2 ATK for each
  one and its 'once per turn' effects don't work. Its controller may pay a 3 flux fine in their Main Phase to remove one.)"
- **Fines:** in your Main Phase you may pay **3 flux** to remove one Complaint from a creature you control, as often as
  you can pay. HOA President makes fines cost its opponent 1 more. Johnny '5 inches' pays out whenever you pay one.
- Complaints stay when a creature changes sides (Space Squid) and go away when it leaves the field.
- **Mall Cop Gary:** enemy creatures with a Complaint can't attack. **Neighborhood Watch** is a Spell that stays in its
  spell zone for your opponent's next 2 turns. Pipebomb can destroy it there.
- **Purrramid** {Cat + Cat} can be made from creatures of any flux cost, an exception to the 5+ flux rule (13).

### 14.7 Descend (Angels, v4.7)
- **Descend:** "when an enemy creature attacks, you may materialize this creature from your hand by paying half its
  flux cost, rounded up; the attack hits this creature instead, and it doesn't hit back." Do it after the attack is declared and its "when this creature
  attacks" effects resolve. Put it in any empty lane; the attacker fights it, whatever lane it's in, whether it was
  attacking a creature or you directly.
- You pay with the flux you have left. **Flux isn't refilled until your Reactor Phase**, so flux you don't spend on
  your turn is there for a Descend on your opponent's turn.
- It's a materialize: "when materialized" effects trigger. It arrived on your opponent's turn, so it can attack on
  yours. **It arrives winded (2026-11-26):** it takes the hit but doesn't hit back, and it stays winded (sideways) until
  the start of your next turn, so it doesn't hit back that turn at all. "When this creature Descends" effects (Judicator
  Angel, Gabe) happen before the fight.
- **Cost (2026-11-26):** half the printed flux cost, rounded up: Cherub 1, Acolyte Adam 1, Purifier Nun 2, Sanctified
  Knight 3, Chapel Guard 3, Judicator Angel 4, Gabe 5. (It used to be the full cost, with the creature hitting back.)
- Bellkeeper Monk and Sanctuary Bells each make your Descends cost 1 less flux, after halving, but a Descend never
  costs less than 0. Fusions can't Descend.

### 14.8 Spellcount (Wizards, v4.7)
- **Spellcount:** the number of spells you've played this turn, including Instants on your opponent's turn. A spell
  counts itself, so the third spell you play sees Spellcount 3. Track it with a die; it goes back to 0 at the end of
  every turn. A negated spell still counts.
- "Spellcount 3+: …" means the bonus applies when your Spellcount is 3 or more as the card resolves.
- **One-shot spell:** a Spell or Instant Spell (not a Continuous or Field Spell). **The Archmage:** the first one-shot
  spell you play each turn resolves twice (costs aren't paid again). **Déjà Vu** plays a one-shot spell from your Waste
  Repository as if it were in your hand, then banishes it. Once per game (2026-11-27): after you've used one Déjà
  Vu's effect, the others do nothing for the rest of the game.
- **Spellcount 3+ only (Abracadabra, Extra Credit):** you can only play the card if it would be at least your 3rd
  spell this turn (it counts itself). A spell Déjà Vu plays counts too, so Déjà Vu as your 2nd spell can play one.
- **Polymorph:** the creature is a Frog with 1 ATK and no effects until the end of your next turn. Its HP doesn't
  change. When it turns back it has the HP it had before Polymorph, so damage it took as a Frog is gone (a Frog that's
  destroyed stays destroyed). A Frog has exactly 1 ATK, so Complaints don't lower it (they're still there when it
  turns back).
- **Frogs and Night School Professor:** a Frog is a creature turned into one by Polymorph (on either side) or a Frog
  Familiar. Once per turn, Night School Professor destroys one to cast Frog Bolt: 5 damage to an enemy creature.
  Destroying an enemy Frog destroys that creature for good, and a Frog Familiar destroyed this way still returns a
  spell to your hand. Frog Bolt counts as a spell you played (Spellcount, Spell Slinger, Battlemage and other
  "whenever you play a spell" effects), but it isn't a card: Pipebomb can't stop it and The Archmage doesn't make
  it resolve twice. Complaints stop it, like any "once per turn" effect.
- **Abracadabra (Spellcount 3+ only):** the creature goes back to its owner's hand as a new card: its damage, Complaints and fusion stack
  are gone, and it has to be materialized again (paying its flux). A creature you took with Space Squid goes back to
  its owner's hand, not yours.
- **Card Trick (2026-11-26):** pick a card from your opponent's hand at random, without looking. They shuffle it into
  their deck and draw 1 card. Only 1 Card Trick per turn. (It used to show you their hand, and at Spellcount 3+ the
  card went to their Waste Repository.)
- **Pocket Fireball (2026-11-26):** can hit a player as well as a creature.
- **Spelling Mistake:** take the ATK and HP the creature has right now (Complaints and other changes included) and
  swap them: the old ATK is its new HP and max HP, and the old HP is its new ATK. Effects that are still going
  (a Complaint, +ATK until end of turn) keep applying afterwards. A creature with 0 ATK is destroyed. On a Frog, its
  HP becomes 1 (a Frog has 1 ATK); when it turns back, its ATK is the HP it had as a Frog and its HP goes back to
  what it had before Polymorph.
- **Extra Credit (Spellcount 3+ only):** the creature can make a second attack in the same Battle Phase, after its first (it's winded
  after the first, as normal). Creatures that can't attack this turn still can't.
- **Wizard Tower:** banish a fusion splice from under it to return a one-shot spell from your Waste Repository to
  your hand. It isn't once per turn, so you can do it once for each splice, and Complaints don't stop it.
- **Community College of Magic:** whoever plays their 3rd spell in a turn gains 1 flux for that turn (both players).

### 14.9 Underdog & Execute (2026-11-27)
- **Underdog:** "this creature deals 2 more combat damage to fusions." One or two cheap creatures per faction have it:
  Acolyte Adam, Vein Ripper, Penny Stock Goblin, Velociraptor, Wild Magic Wizard and Plush Goblin. It counts when it attacks and when it hits back.
- **Execute:** "when this creature deals combat damage to a creature, if that creature has half its max HP or less
  left, destroy it." Half rounds down: a 16 HP creature left at 8 or less is destroyed. Chapel Guard and Seraphim Wall
  can still save it. On The Feeble Fusion.

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
   Since 2026-11-26 cards print it: "You can only use this effect of Blood Ledger once per turn" (two Blood Ledgers
   still search once), "You can only Fossil T-Rex once per turn", and for one-shot spells "You can only play 1 Microwave
   per turn". A Complaint stops these effects like any "once per turn" effect.
8. **Targeting:** an effect targets when it chooses a specific card. Attacking isn't targeting for "untargetable".
9. **Simultaneous effects:** the player whose turn it is resolves theirs first, in the order they choose.

## 16. Quick reference

| | |
|---|---|
| Starting PHP | 30. Restoring can't take you above 30; gaining can |
| Main Deck / Fusion Deck | 30 / up to 10, max 3 copies |
| Opening hand | 5. One free redraw if it has 0–1 creatures; mulligan only if both agree |
| Arriving | Creatures can attack the turn they arrive; fusions can't (they're winded) |
| Draw per turn | 1 (first player skips their first) |
| Flux | starts 3, +1 a turn, max 10. Second player +1 on their first turn |
| Reactor Phase | +1 max flux and refill; or also Feed (a card to Oblivion: +1 flux this turn); or Skip (no +1, draw 1) |
| Lanes / spell zones / field spells | 3 / 3 / 1 per player |
| Speed | 1–8, 4 is normal. Faster strikes first; on a tie the attacker does |
| Winded | Turn it sideways. A creature that attacked, or a fusion just made, can't hit back when attacked until your next turn. On a direct attack it still hits back, last |
| Fusing | once per turn, 2 flux, two 5+ flux creatures (or fusions) in lanes next to each other. The fusion keeps their damage and is winded |
| Unfuse | the splices come back at full HP and split the fusion's damage, never below 1 HP |
| Empty deck | lose 5 PHP for each draw you can't make |
| Hand limit | 8 |
| Complaint | −2 ATK each, no "once per turn" effects. Pay a 3 flux fine in your Main Phase to remove one |
| Descend | On your opponent's turn, when an enemy attacks: materialize it from your hand for half its flux (rounded up) from your leftover flux; the attack hits it, and it arrives winded (no hitting back) |
| Radiance | Only the first restore past max each turn becomes a bonus |
| Spellcount | Spells you've played this turn, counting the one being played |
| Face-down spells | Set a spell in your Main Phase; from your opponent's next turn, flip and play it whenever you could play an Instant |

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
one does a different job (bounce, hand disruption, burn, recursion, Frogs, an ATK/HP swap, a second attack); Wild
Magic, the d6 of chaos, was cut in the card audit. In a 1,000,000-game round robin of 200 decks (14 starters, 166
themed decks and 20 "meta" decks tuned only to win), Night School won 47% and Wizard decks 42% on average. Angels with Descend win about 61% (51% with the same deck and no Descend); Fallen Grace and
Holy Hustle barely changed.

**Stat budget.** points = ATK + HP ÷ 2 + (Speed − 4) ÷ 2 + effect, aiming for **2 × flux + 1** (about 20 for Ultras) and
**28 for fusions**. Two 5-flux creatures are worth 22, so a fusion pays them back plus the fuse.

- **Linear from 1 to 10 (2026-11-26):** in theory a 10 flux card should be about 8 times a 1 flux card, in stats or in
  an effect that's worth it. Gabe was 6/14, about twice as useful as a Cherub (1/2) for ten times the flux; he's now
  8/16 (8 × Cherub), and Judicator Angel is 6/12 (was 4/10). By this line the budget is about **(7 × flux + 2) ÷ 3**:
  10 at 4 flux, 12 at 5, 15 at 6, 17 at 7, 22 at 9 and 24 at 10 (1 point more than 2 × flux + 1 at 5 flux, 3 more at
  10). Other expensive creatures haven't been moved up to it yet.

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
