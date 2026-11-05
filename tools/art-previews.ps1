# Redraws the card previews the art board shows (art\previews\<card>.jpg, 520 px wide), using the card editor's
# exporter. Run it after changing cards or placeholder art; the editor's next save (or a push) puts them on GitHub.
#   tools\art-previews.ps1
param([int]$Width = 520, [int]$Quality = 84)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tmp = Join-Path $env:TEMP 'fusion-fuckery-previews'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
& (Join-Path $PSScriptRoot 'export-cards.ps1') -OutDir $tmp

Add-Type -AssemblyName System.Drawing
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$params = New-Object Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), ([long]$Quality)
$out = Join-Path $root 'art\previews'
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $out -Filter *.jpg | Remove-Item   # drops renamed and frozen cards

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
