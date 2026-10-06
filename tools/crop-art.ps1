# Cuts the art out of finished card PNGs (744x1039) and writes art\*.jpg + art\art.js (card name -> image).
# Usage: .\crop-art.ps1 [-Src "folder with card PNGs"]
param([string]$Src = "X:\Projects\tcg\Card files\v3\all cards png")
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$src = $Src
$out = Join-Path $root "art"
New-Item -ItemType Directory -Force $out | Out-Null
$rows = Import-Csv (Join-Path $root "saves\Base set - Fusion Fuckery - v6.csv") -Encoding UTF8
function norm($s) { ($s.ToLower() -replace '[^a-z0-9]', '') }
$files = @{}; Get-ChildItem $src -File | % { $files[(norm $_.BaseName)] = $_ }
# CSV name (normalized) -> png base name, for names that differ
$over = @{
  (norm "Primordial Soup") = "Primourdial Soup"; (norm "Cherub") = "Lantern Cherub"
  (norm "Renroc The Dark Marquis") = "Renroc The Dark Marqui"; (norm "Gregg") = "Greg"
  (norm "Gregg's Vape") = "Greg's Vape"; (norm "Sacrificial Lamb") = "Sacraficial Lamb"
  (norm "RS PRO 115mm Stainless Steel Curved Tweezers") = "Tweezers"
}
$rect = New-Object Drawing.Rectangle 40, 80, 665, 460   # inside of the black art frame
$codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | ? { $_.MimeType -eq "image/jpeg" }
$ep = New-Object Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 90L
$manifest = [ordered]@{}; $missing = @()
foreach ($r in $rows) {
  $n = norm $r.Name
  if ($n.StartsWith("galorpian")) { $key = "galorpian" } elseif ($over.ContainsKey($n)) { $key = norm $over[$n] } else { $key = $n }
  if (-not $files.ContainsKey($key)) { $missing += $r.Name; continue }
  $f = $files[$key]
  $safe = ($f.BaseName -replace '[^\w\- ]', '').Trim() + ".jpg"
  $bmp = New-Object Drawing.Bitmap $f.FullName
  $crop = $bmp.Clone($rect, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $crop.Save((Join-Path $out $safe), $codec, $ep)
  $crop.Dispose(); $bmp.Dispose()
  $manifest[$r.Name] = "art/" + $safe
}
$json = $manifest | ConvertTo-Json -Compress
[IO.File]::WriteAllText((Join-Path $out "art.js"), "window.CARD_ART = $json;`n", (New-Object Text.UTF8Encoding $false))
"matched: $($manifest.Count)"; "no art: "; $missing
