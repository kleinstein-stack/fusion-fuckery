"""Builds PATCH-NOTES.md from tools/patch-notes-template.md: every "<!-- cards: OLD..NEW -->" line becomes the card changes
between those two commits, worked out from saves/Base set - Fusion Fuckery - v6.csv (new, removed, renamed, cold
storage, stats, attributes and reworded text). The rules notes in the template are written by hand.
  python tools/patch-notes.py
For a new patch: add a section at the top of the template, with "<!-- cards: <last patch's commit>..<new commit> -->"
(or "..HEAD" / "..WORKTREE" for changes not committed yet), and run it again."""
import csv, difflib, io, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = "saves/Base set - Fusion Fuckery - v6.csv"
GIT = os.environ.get("GIT", r"C:\Program Files\Git\cmd\git.exe" if os.name == "nt" else "git")
FORCE = {"Bobblin Miner": "Goblin Miner", "Jonnhy '5 inches'": "Johnny '5 inches'", "Boss's Orders": "You're FIRED!",
         "The Flock": "The Feeble Fusion"}   # renames whose text changed too much to spot
BLANK = {"", "n/a", "/", "-", "–"}
STATS = [("Type", "Type"), ("ATK", "ATK"), ("HP", "HP"), ("Flux Cost", "Flux"), ("Speed", "Speed")]

def load(ref):
    if ref == "WORKTREE": raw = open(os.path.join(ROOT, CSV), "rb").read()
    else: raw = subprocess.run([GIT, "-C", ROOT, "show", f"{ref}:{CSV}"], capture_output=True, check=True).stdout
    out = {}
    for r in csv.DictReader(io.StringIO(raw.decode("utf-8", "replace").lstrip("\ufeff"), newline="")):
        n = (r.get("Name") or "").strip()
        if n: out[n] = {k.strip(): (v or "").strip() for k, v in r.items() if k}
    return out

def live(c): return not c.get("Cold Storage")
def flat(t): return " / ".join(x.strip() for x in t.split("\n") if x.strip())
def esc(t): return t.replace("<", "&lt;").replace(">", "&gt;")

def renames(gone, new, a, b):
    """Pair removed and added cards that are the same card under a new name (similar text, or the same stats)."""
    pairs = []
    for o in list(gone):
        if FORCE.get(o) in new: pairs.append((o, FORCE[o])); gone.remove(o); new.remove(FORCE[o]); continue
        best = None
        for n in new:
            if a[o].get("Type") != b[n].get("Type"): continue
            r = difflib.SequenceMatcher(None, flat(a[o].get("Description", "")), flat(b[n].get("Description", ""))).ratio()
            same = all(a[o].get(k) == b[n].get(k) for k in ("ATK", "HP", "Flux Cost")) and a[o].get("ATK")
            score = r + (0.3 if same else 0)
            if score >= 0.6 and (not best or score > best[0]): best = (score, n)
        if best: pairs.append((o, best[1])); gone.remove(o); new.remove(best[1])
    return pairs

def section(span):
    old, new_ref = span.split("..")
    a, b = load(old), load(new_ref)
    added = [n for n in b if n not in a]; removed = [n for n in a if n not in b]
    ren = renames(removed, added, a, b)
    lines = ["**Card changes**", ""]
    add = lambda label, items: items and lines.append(f"- **{label}:** " + ", ".join(items))
    add("New", [n for n in added if live(b[n])] + [f"{n} (in cold storage)" for n in added if not live(b[n])])
    add("Removed", removed)
    add("Renamed", [f"{o} → {n}" for o, n in ren])
    both = [(n, n) for n in b if n in a] + ren
    add("Into cold storage", [m for o, m in both if live(a[o]) and not live(b[m])])
    add("Back from cold storage", [m for o, m in both if not live(a[o]) and live(b[m])])
    stat, attr, text, speed_new = [], [], [], 0
    for o, m in both:
        x, y = a[o], b[m]
        if not live(x) and not live(y): continue
        ch = []
        for k, label in STATS:
            if x.get(k, "") != y.get(k, "") and not (x.get(k, "").lower() in BLANK and y.get(k, "").lower() in BLANK):
                if k == "Speed" and not x.get(k): speed_new += 1; continue
                ch.append(f"{label} {x.get(k) or '–'} → {y.get(k) or '–'}")
        if ch: stat.append(f"{m}: " + ", ".join(ch))
        if x.get("Attribute", "") != y.get("Attribute", ""): attr.append(f"{m}: {x.get('Attribute') or '–'} → {y.get('Attribute') or '–'}")
        if flat(x.get("Description", "")) != flat(y.get("Description", "")): text.append((m, flat(x.get("Description", "")), flat(y.get("Description", ""))))
    if speed_new: lines.append(f"- **Speed** added to {speed_new} creatures and fusions.")
    for label, items in (("Stats", stat), ("Attributes", attr)):
        if items: lines.append(f"- **{label}:**"); lines.extend(f"  - {t}" for t in items)
    if text:
        lines += ["", "<details>", f"<summary>{len(text)} card{'s' if len(text) != 1 else ''} reworded (old and new text)</summary>", ""]
        for m, t0, t1 in text:
            lines.append(f"- **{esc(m)}**")
            lines.append(f"  - Before: {esc(t0) or '(no text)'}")
            lines.append(f"  - After: {esc(t1) or '(no text)'}")
        lines += ["", "</details>"]
    if len(lines) == 2: lines.append("- No card changes.")
    return "\n".join(lines)

tpl = open(os.path.join(ROOT, "tools", "patch-notes-template.md"), encoding="utf-8").read()
out = re.sub(r"<!-- cards: ([^ ]+) -->", lambda m: section(m.group(1)), tpl)
open(os.path.join(ROOT, "PATCH-NOTES.md"), "w", encoding="utf-8", newline="\n").write(out)
print("PATCH-NOTES.md:", len(out), "characters")
