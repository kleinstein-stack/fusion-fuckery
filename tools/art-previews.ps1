# Redraws the card previews the art board shows (art\previews\<card>.jpg, 520 px wide), using the card editor's
# exporter. Run it after changing cards or placeholder art; the editor's next save (or a push) puts them on GitHub.
#   tools\art-previews.ps1                          -> every card
#   tools\art-previews.ps1 -Only "Chimera,Cherub"   -> just those cards
#   tools\art-previews.ps1 -Finished                -> art\cards\<card>.jpg with the editor's art, for the board's
#                                                      deck builder and Decks tab (run it after new art or card changes)
param([int]$Width = 520, [int]$Quality = 84, [string[]]$Only, [switch]$Finished)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tmp = Join-Path $env:TEMP 'fusion-fuckery-previews'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
$export = @{ OutDir = $tmp }
if ($Only) { $export.Only = $Only }
# the art board's left-hand preview always shows the placeholder art (saves\placeholder-art.json), even once finished
# art is in; the deck builder's cards show the art the editor uses
if (-not $Finished) { $export.Placeholder = $true }
& (Join-Path $PSScriptRoot 'export-cards.ps1') @export

Add-Type -AssemblyName System.Drawing
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$params = New-Object Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), ([long]$Quality)
$out = Join-Path $root $(if ($Finished) { 'art\cards' } else { 'art\previews' })
New-Item -ItemType Directory -Force $out | Out-Null
if (-not $Only) { Get-ChildItem $out -Filter *.jpg | Remove-Item }   # a full run drops renamed and frozen cards

# the same file name the board builds from a card name: no accents, lower case, words joined by "-"
function Slug([string]$n) {
  $d = $n.Normalize([Text.NormalizationForm]::FormKD)
  $plain = -join ($d.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' })
  return ($plain.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
}

$done = 0
foreach ($f in Get-ChildItem $tmp -Filter *.jpg) {
  $img = [Drawing.Image]::FromFile($f.FullName)
  try {
    $h = [int][Math]::Round($img.Height * $Width / $img.Width)
    $bmp = New-Object Drawing.Bitmap($Width, $h)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
    $g.DrawImage($img, 0, 0, $Width, $h)
    $bmp.Save((Join-Path $out ((Slug $f.BaseName) + '.jpg')), $jpeg, $params)
    $g.Dispose(); $bmp.Dispose(); $done++
  } finally { $img.Dispose() }
}
Remove-Item $tmp -Recurse -Force
"Saved $done card previews to $out"
