# Local helper for card-editor.html: serves the page and reads/writes the saves folder.
# Works in any browser (incl. Firefox). Only listens on localhost. Close the window to stop.
$ErrorActionPreference = 'Stop'
$root     = $PSScriptRoot
$saves    = Join-Path $root 'saves'
$versions = Join-Path $saves 'versions'
$defaultName = 'Base set - Fusion Fuckery - v6.csv'
$port = 8770
New-Item -ItemType Directory -Force $versions | Out-Null

$url = "http://localhost:$port/"
$listener = New-Object Net.HttpListener
$listener.Prefixes.Add($url)
try { $listener.Start() } catch {
  Write-Host "Port $port is busy - the editor is probably already running. Opening it."
  if (-not $env:CARD_EDITOR_NO_BROWSER) { Start-Process $url }
  Start-Sleep 2; exit
}
Write-Host "Card editor running at $url"
Write-Host "Saves folder: $saves"
Write-Host "Close this window to stop the editor."
if (-not $env:CARD_EDITOR_NO_BROWSER) { Start-Process $url }

$utf8 = New-Object Text.UTF8Encoding $false

# ---- GitHub sync: if this folder is a git repo, pull before loading and push after saving ----
$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git -and (Test-Path 'C:\Program Files\Git\cmd\git.exe')) { $git = 'C:\Program Files\Git\cmd\git.exe' }
$useGit = [bool]($git -and (Test-Path (Join-Path $root '.git')))
$env:GIT_TERMINAL_PROMPT = '0'   # never hang waiting for a password in this hidden window
$script:lastPull = [datetime]::MinValue
function Git {
  $ErrorActionPreference = 'Continue'
  $out = & $git -C $root @args 2>&1
  [pscustomobject]@{ ok = ($LASTEXITCODE -eq 0); text = (($out | ForEach-Object { "$_" }) -join "`n").Trim() }
}
function GitPull([switch]$Force) {
  if (-not $useGit) { return $null }
  if (-not $Force -and ((Get-Date) - $script:lastPull).TotalSeconds -lt 20) { return 'up to date' }
  $script:lastPull = Get-Date
  $r = Git pull --rebase --autostash -q
  if ($r.ok) { return 'up to date with GitHub' }
  Git rebase --abort | Out-Null
  return "GitHub sync failed: $($r.text)"
}
function GitPush([string]$msg) {
  if (-not $useGit) { return $null }
  Git add -A -- saves art | Out-Null
  $c = Git commit -q -m $msg
  if (-not $c.ok -and $c.text -notmatch 'nothing to commit') { return "GitHub sync failed: $($c.text)" }
  $p = Git push -q
  if (-not $p.ok) { [void](GitPull -Force); $p = Git push -q }   # someone saved online meanwhile
  if ($p.ok) { return 'synced to GitHub' } else { return "GitHub sync failed: $($p.text)" }
}
if ($useGit) { Write-Host (GitPull -Force) }
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css';
            '.jpg'='image/jpeg'; '.png'='image/png'; '.webp'='image/webp'; '.csv'='text/csv; charset=utf-8'; '.json'='application/json' }

function AddCors($ctx) {
  # card-editor.html opened straight from disk (file://) has origin "null"; let only that page talk to us.
  if ($ctx.Request.Headers['Origin'] -eq 'null') {
    $ctx.Response.Headers['Access-Control-Allow-Origin'] = 'null'
    $ctx.Response.Headers['Access-Control-Allow-Headers'] = 'X-Card-Editor, Content-Type'
    $ctx.Response.Headers['Access-Control-Allow-Methods'] = 'GET, POST'
    $ctx.Response.Headers['Access-Control-Expose-Headers'] = 'X-File-Name, X-Modified'
  }
}
function Send($ctx, [int]$code, [string]$type, [byte[]]$bytes) {
  AddCors $ctx
  $ctx.Response.StatusCode = $code
  $ctx.Response.ContentType = $type
  $ctx.Response.Headers['Cache-Control'] = 'no-store'
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}
function SendText($ctx, [int]$code, [string]$type, [string]$text) { Send $ctx $code $type ($utf8.GetBytes($text)) }
function SendJson($ctx, $obj) { SendText $ctx 200 'application/json' (ConvertTo-Json -InputObject $obj -Depth 5 -Compress) }
function SafeCsvName([string]$n) {
  $n = [IO.Path]::GetFileName($n)
  if (-not $n -or $n -notmatch '\.csv$') { throw "Bad file name" }
  return $n
}
function NewestVersion { Get-ChildItem $versions -Filter *.csv -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1 }
function ReadText($path) { [IO.File]::ReadAllText($path, $utf8) }
function WriteVersion([string]$base, [datetime]$when, [string]$text) {
  $name = "$base $($when.ToString('yyyy-MM-dd HH-mm-ss')).csv"; $i = 2
  while (Test-Path -LiteralPath (Join-Path $versions $name)) { $name = "$base $($when.ToString('yyyy-MM-dd HH-mm-ss'))-$i.csv"; $i++ }
  $p = Join-Path $versions $name
  [IO.File]::WriteAllText($p, $text, $utf8)
  (Get-Item -LiteralPath $p).LastWriteTime = $when
  return $name
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
  try {
    if ($req.HttpMethod -eq 'OPTIONS') { AddCors $ctx; $ctx.Response.StatusCode = 204; $ctx.Response.Close(); continue }
    # Writes must come from the editor page (it sends this header; other websites can't).
    if ($req.HttpMethod -eq 'POST' -and $req.Headers['X-Card-Editor'] -ne '1') { SendText $ctx 403 'text/plain' 'forbidden'; continue }
    if ($path -eq '/api/ping') { SendJson $ctx @{ ok = $true; saves = $saves }; continue }

    if ($path -eq '/api/latest') {
      $sync = GitPull; if ($sync) { $ctx.Response.Headers['X-Sync'] = $sync }
      $f = Get-ChildItem $saves -Filter *.csv -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if (-not $f) { SendText $ctx 404 'text/plain' 'no saves yet'; continue }
      $ctx.Response.Headers['X-File-Name'] = [Uri]::EscapeDataString($f.Name)
      $ctx.Response.Headers['X-Modified'] = [string][long]($f.LastWriteTimeUtc - [datetime]'1970-01-01').TotalMilliseconds
      Send $ctx 200 'text/csv; charset=utf-8' ([IO.File]::ReadAllBytes($f.FullName)); continue
    }

    if ($path -eq '/api/save' -and $req.HttpMethod -eq 'POST') {
      $name = $req.QueryString['name']
      $name = if ($name) { SafeCsvName $name } else { $defaultName }
      $text = (New-Object IO.StreamReader($req.InputStream, $utf8)).ReadToEnd()
      $target = Join-Path $saves $name
      $base = [IO.Path]::GetFileNameWithoutExtension($name)
      # Keep whatever was there before as a version too, if it isn't already.
      if (Test-Path -LiteralPath $target) {
        $old = ReadText $target; $nv = NewestVersion
        if (-not $nv -or (ReadText $nv.FullName) -ne $old) { [void](WriteVersion $base (Get-Item -LiteralPath $target).LastWriteTime $old) }
      }
      [IO.File]::WriteAllText($target, $text, $utf8)
      $nv = NewestVersion; $made = $null
      if (-not $nv -or (ReadText $nv.FullName) -ne $text) { $made = WriteVersion $base (Get-Date) $text }
      $sync = GitPush "Update cards (local editor)"
      SendJson $ctx @{ ok = $true; file = $name; version = $made; sync = $sync }; continue
    }

    if ($path -eq '/api/versions') {
      $list = @(Get-ChildItem $versions -Filter *.csv -File | Sort-Object LastWriteTime -Descending | ForEach-Object {
        @{ name = $_.Name; size = $_.Length; modified = [long]($_.LastWriteTimeUtc - [datetime]'1970-01-01').TotalMilliseconds } })
      SendJson $ctx $list; continue
    }

    if ($path -eq '/api/version') {
      $p = Join-Path $versions (SafeCsvName $req.QueryString['name'])
      if (-not (Test-Path -LiteralPath $p)) { SendText $ctx 404 'text/plain' 'not found'; continue }
      Send $ctx 200 'text/csv; charset=utf-8' ([IO.File]::ReadAllBytes($p)); continue
    }

    # ---- card art overrides: saves/art-overrides.json maps card name -> image path under art/ ----
    if ($path -like '/api/art*') {
      $mapFile = Join-Path $saves 'art-overrides.json'
      $map = @{}
      if (Test-Path -LiteralPath $mapFile) {
        (ConvertFrom-Json (ReadText $mapFile)).PSObject.Properties | ForEach-Object { $map[$_.Name] = [string]$_.Value }
      }
      $saveMap = { [IO.File]::WriteAllText($mapFile, (ConvertTo-Json -InputObject $map -Compress), $utf8) }
      $card = $req.QueryString['name']

      if ($path -eq '/api/art-map') { SendJson $ctx $map; continue }
      if (-not $card) { throw 'missing card name' }

      if ($path -eq '/api/art' -and $req.HttpMethod -eq 'POST') {
        $ms = New-Object IO.MemoryStream; $req.InputStream.CopyTo($ms); $bytes = $ms.ToArray()
        if ($bytes.Length -lt 100 -or $bytes.Length -gt 20MB) { throw 'bad image size' }
        $ext = switch ($req.ContentType) { 'image/png' { '.png' } 'image/webp' { '.webp' } default { '.jpg' } }
        $safe = ($card -replace '[^\w\- ]', '').Trim(); if (-not $safe) { $safe = 'card' }
        if ($safe.Length -gt 60) { $safe = $safe.Substring(0, 60) }
        $dir = Join-Path $root 'art\custom'; New-Item -ItemType Directory -Force $dir | Out-Null
        $file = "$safe $((Get-Date).ToString('yyyy-MM-dd HH-mm-ss'))$ext"   # new name each time: old art is kept
        [IO.File]::WriteAllBytes((Join-Path $dir $file), $bytes)
        $map[$card] = "art/custom/$file"; & $saveMap
        $sync = GitPush "New art for $card"
        SendJson $ctx @{ ok = $true; path = $map[$card]; sync = $sync }; continue
      }
      if ($path -eq '/api/art-link' -and $req.HttpMethod -eq 'POST') {   # keep art when a card is renamed
        $p = $req.QueryString['path']
        if (-not $p -or $p -notmatch '^art/' -or $p -match '\.\.') { throw 'bad art path' }
        $map[$card] = $p; & $saveMap; [void](GitPush "Keep art for renamed $card"); SendJson $ctx @{ ok = $true }; continue
      }
      if ($path -eq '/api/art-reset' -and $req.HttpMethod -eq 'POST') {
        $map.Remove($card); & $saveMap; [void](GitPush "Reset art for $card"); SendJson $ctx @{ ok = $true }; continue
      }
    }

    if ($path -eq '/api/decks') {
      $p = Join-Path $saves 'decks.json'
      if ($req.HttpMethod -eq 'POST') {
        $body = (New-Object IO.StreamReader($req.InputStream, $utf8)).ReadToEnd()
        [IO.File]::WriteAllText($p, $body, $utf8); SendJson $ctx @{ ok = $true }
      } elseif (Test-Path -LiteralPath $p) { Send $ctx 200 'application/json' ([IO.File]::ReadAllBytes($p)) }
      else { SendText $ctx 404 'text/plain' 'none' }
      continue
    }

    # static files from this folder only
    $rel = $path.TrimStart('/'); if (-not $rel) { $rel = 'card-editor.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $full.StartsWith($root.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      SendText $ctx 404 'text/plain' 'not found'; continue
    }
    $type = $types[[IO.Path]::GetExtension($full).ToLower()]; if (-not $type) { $type = 'application/octet-stream' }
    Send $ctx 200 $type ([IO.File]::ReadAllBytes($full))
  } catch {
    try { SendText $ctx 500 'text/plain' $_.Exception.Message } catch {}
  }
}
