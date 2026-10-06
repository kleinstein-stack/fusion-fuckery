# Rebuilds card-editor.html (and index.html for the website) from tools\editor-template.html.
# Embeds the blank card backgrounds and a built-in copy of the latest saved CSV.
$tools = $PSScriptRoot
$root  = Split-Path $tools -Parent
$utf8  = New-Object Text.UTF8Encoding $false

$t = [IO.File]::ReadAllText("$tools\editor-template.html", $utf8)
function b64($f) { "data:image/png;base64," + [Convert]::ToBase64String([IO.File]::ReadAllBytes("$tools\templates\$f")) }
$csv = [IO.File]::ReadAllText("$root\saves\Base set - Fusion Fuckery - v6.csv", $utf8)
Add-Type -AssemblyName System.Web
$json = '"' + [System.Web.HttpUtility]::JavaScriptStringEncode($csv) + '"'
$t = $t.Replace("__IMG_CREATURE__", (b64 "creature.png")).Replace("__IMG_FUSION__", (b64 "fusion.png")).Replace("__IMG_SPELL__", (b64 "spell.png")).Replace("__CSV_DATA__", $json)
[IO.File]::WriteAllText("$root\card-editor.html", $t, $utf8)
[IO.File]::WriteAllText("$root\index.html", $t, $utf8)
"Built card-editor.html and index.html"
