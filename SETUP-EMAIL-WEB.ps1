$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'AERIX Gmail HTTPS setup' -ForegroundColor Cyan
Write-Host 'Run this only after deploying google-apps-script/Code.gs from aerixcompany@gmail.com.'
$webUrl = if ($env:AERIX_SETUP_WEB_URL) {
  $env:AERIX_SETUP_WEB_URL.Trim()
} else {
  (Read-Host 'Google Apps Script Web app URL ending in /exec').Trim()
}
if ($webUrl -notmatch '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$') {
  throw 'Enter the exact HTTPS Web app deployment URL ending in /exec.'
}
$secretDirectory = Join-Path $PSScriptRoot '.secrets'
$secretFile = Join-Path $secretDirectory 'email.dpapi'
$settings = @{}
$codeBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($codeBytes) } finally { $rng.Dispose() }
$settings.EMAIL_CODE_SECRET = [Convert]::ToBase64String($codeBytes)
$tokenBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($tokenBytes) } finally { $rng.Dispose() }
$webToken = [Convert]::ToBase64String($tokenBytes)
$settings.EMAIL_WEB_URL = $webUrl
$settings.EMAIL_WEB_TOKEN = $webToken
New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
$encrypted = ConvertFrom-SecureString (ConvertTo-SecureString ($settings | ConvertTo-Json -Compress) -AsPlainText -Force)
[IO.File]::WriteAllText($secretFile, $encrypted)
Set-Clipboard -Value $webToken
Write-Host 'The new private token is on the clipboard. Paste it into the AERIX_TOKEN Script Property, then clear the clipboard.' -ForegroundColor Yellow
Write-Host 'This setup replaced old Gmail SMTP settings and rotated the email-code secret.'
Write-Host 'Do not share the token in chat. Then run npm run check:email with VPN ON.'
