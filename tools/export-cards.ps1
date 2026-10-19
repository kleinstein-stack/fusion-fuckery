# Exports every card that isn't in cold storage as a JPEG at print size (744 x 1039 px = 63 x 88 mm at 300 dpi),
# drawn by the card editor itself through headless Edge (or Chrome).
#   tools\export-cards.ps1                    -> exports\cards\<Card name>.jpg
#   tools\export-cards.ps1 -OutDir D:\cards   -> another folder
#   tools\export-cards.ps1 -Only Cherub, Orc  -> just those cards
param([string]$OutDir, [string[]]$Only, [int]$Port = 8799, [int]$Quality = 92)
$ErrorActionPreference = 'Stop'
$tools = $PSScriptRoot
$root  = Split-Path $tools -Parent
$defaultOut = Join-Path $root 'exports\cards'
if (-not $OutDir) { $OutDir = $defaultOut }

$browser = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
             "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
             "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
             "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'This needs Microsoft Edge or Google Chrome installed.' }

# 1. Rebuild, so the editor carries the latest saved card list.
& "$tools\build.ps1" | Out-Null

# 2. Cards to export: everything with a name that isn't in cold storage.
$csv = Join-Path $root 'saves\Base set - Fusion Fuckery - v6.csv'
$names = Import-Csv $csv -Encoding UTF8 | Where-Object {
  $_.Name.Trim() -and ("$($_.'Cold Storage')".Trim() -notmatch '^(yes|y|true|1|x)$')
} | ForEach-Object { $_.Name.Trim() }
if ($Only) { $Only = $Only -split ',' | ForEach-Object { $_.Trim() }; $names = $names | Where-Object { $Only -contains $_ } }
if (-not $names) { throw 'No cards to export.' }

# 3. A small web server for the editor files, on this PC only, while the export runs.
$server = Start-Job -ArgumentList $root, $Port -ScriptBlock {
  param($root, $port)
  $types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css';
              '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.png' = 'image/png'; '.webp' = 'image/webp';
              '.json' = 'application/json'; '.csv' = 'text/csv; charset=utf-8' }
  $l = New-Object Net.HttpListener; $l.Prefixes.Add("http://localhost:$port/"); $l.Start()
  while ($l.IsListening) {
    $ctx = $l.GetContext()
    if ($ctx.Request.Url.AbsolutePath -eq '/__stop') { $ctx.Response.Close(); $l.Stop(); break }
    $full = [IO.Path]::GetFullPath((Join-Path $root ([Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/')))))
    if ($full.StartsWith($root + [IO.Path]::DirectorySeparatorChar) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($full)
      $type = $types[[IO.Path]::GetExtension($full).ToLower()]
      $ctx.Response.ContentType = $(if ($type) { $type } else { 'application/octet-stream' })
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
    $ctx.Response.Close()
  }
}
try {
  $up = $false
  for ($i = 0; $i -lt 40 -and -not $up; $i++) {
    try { $up = (Invoke-WebRequest "http://localhost:$Port/index.html" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { Start-Sleep -Milliseconds 250 }
  }
  if (-not $up) { throw "The local web server didn't start on port $Port." }

  # 4. Render each card and save it as a JPEG.
  New-Item -ItemType Directory -Force $OutDir | Out-Null
  if ($OutDir -eq $defaultOut -and -not $Only) { Get-ChildItem $OutDir -Filter *.jpg | Remove-Item }   # drop renamed / frozen cards
  Add-Type -AssemblyName System.Drawing
  $jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
  $params = New-Object Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), ([long]$Quality)
  $profileDir = Join-Path $env:TEMP 'fusion-fuckery-export-profile'
  $png = Join-Path $env:TEMP 'fusion-fuckery-card.png'
  $done = 0
  foreach ($name in $names) {
    $url = "http://localhost:$Port/index.html#render=" + [Uri]::EscapeDataString($name)
    if (Test-Path $png) { Remove-Item $png }
    $args = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=744,1039',
              '--virtual-time-budget=8000', '--no-first-run', "`"--user-data-dir=$profileDir`"", "`"--screenshot=$png`"", "`"$url`"")
    Start-Process -FilePath $browser -ArgumentList $args -WindowStyle Hidden
    # Wait for the screenshot to be written, then close that headless browser: it lingers for ~40 s otherwise.
    $deadline = (Get-Date).AddSeconds(30); $last = -1
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Milliseconds 200
      if (Test-Path $png) { $len = (Get-Item $png).Length; if ($len -gt 0 -and $len -eq $last) { break }; $last = $len }
    }
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$profileDir*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    if (-not (Test-Path $png)) { Write-Warning "No image for $name"; continue }
    $img = [Drawing.Image]::FromFile($png)
    try {
      if ($img.Width -ne 744 -or $img.Height -ne 1039) { Write-Warning "$name came out $($img.Width)x$($img.Height)" }
      $file = Join-Path $OutDir ((($name -replace '[\\/:*?"<>|]', '').Trim()) + '.jpg')
      $img.Save($file, $jpeg, $params); $done++
    } finally { $img.Dispose() }
  }
  Remove-Item $png -ErrorAction SilentlyContinue
  "Exported $done of $(@($names).Count) cards to $OutDir"
} finally {
  # the server waits for requests, so ask it to stop (Stop-Job alone hangs for minutes)
  try { Invoke-WebRequest "http://localhost:$Port/__stop" -UseBasicParsing -TimeoutSec 2 | Out-Null } catch {}
  Wait-Job $server -Timeout 5 | Out-Null
  Remove-Job $server -Force -ErrorAction SilentlyContinue
}
