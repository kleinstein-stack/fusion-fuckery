# Opens the card editor: starts the save helper hidden in the background if it isn't running yet,
# then opens the editor in Firefox (or the default browser).
$url = 'http://localhost:8770/'
function HelperUp { try { Invoke-WebRequest -UseBasicParsing "$($url)api/ping" -TimeoutSec 1 | Out-Null; $true } catch { $false } }

if (-not (HelperUp)) {
  $env:CARD_EDITOR_NO_BROWSER = '1'   # we open the browser ourselves below
  Start-Process powershell -WindowStyle Hidden -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$(Join-Path $PSScriptRoot 'server.ps1')`"")
  for ($i = 0; $i -lt 40 -and -not (HelperUp); $i++) { Start-Sleep -Milliseconds 250 }
}

$ff = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe' -ErrorAction SilentlyContinue).'(default)'
if ($ff -and (Test-Path $ff)) { Start-Process $ff $url } else { Start-Process $url }
