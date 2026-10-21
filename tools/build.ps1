# Rebuilds card-editor.html (and index.html for the website) from tools\editor-template.html.
# Embeds the blank card backgrounds (v4 frames), the spell-type symbols, a built-in copy of the latest saved CSV and
# the battle simulator (tools\battle-sim.js).
$tools = $PSScriptRoot
$root  = Split-Path $tools -Parent
$utf8  = New-Object Text.UTF8Encoding $false

$t = [IO.File]::ReadAllText("$tools\editor-template.html", $utf8)
function b64($f) { "data:image/png;base64," + [Convert]::ToBase64String([IO.File]::ReadAllBytes("$tools\templates\$f")) }
$csv = [IO.File]::ReadAllText("$root\saves\Base set - Fusion Fuckery - v6.csv", $utf8)
Add-Type -AssemblyName System.Web
$json = '"' + [System.Web.HttpUtility]::JavaScriptStringEncode($csv) + '"'
# Built-in copy of the saved decks (starter decks etc.), used when the helper / GitHub can't provide them
$decksFile = "$root\saves\decks.json"
$decks = if (Test-Path $decksFile) { [IO.File]::ReadAllText($decksFile, $utf8).Trim().Replace("</", "<\/") } else { '{"decks":[]}' }
$t = $t.Replace("__IMG_CREATURE__", (b64 "creature.png")).Replace("__IMG_FUSION__", (b64 "fusion.png")).Replace("__IMG_SPELL__", (b64 "spell.png")).Replace("__SYM_INSTANT__", (b64 "sym-instant.png")).Replace("__SYM_FIELD__", (b64 "sym-field.png")).Replace("__SYM_CONTINUOUS__", (b64 "sym-continuous.png")).Replace("__CSV_DATA__", $json).Replace("__DECKS_DATA__", $decks)
# The battle simulator goes in last, so the placeholders above can't match inside it
$engine = [IO.File]::ReadAllText("$tools\battle-sim.js", $utf8).Replace("</script", "<\/script")
$t = $t.Replace("__BATTLE_ENGINE__", $engine)
[IO.File]::WriteAllText("$root\card-editor.html", $t, $utf8)
[IO.File]::WriteAllText("$root\index.html", $t, $utf8)
"Built card-editor.html and index.html"
