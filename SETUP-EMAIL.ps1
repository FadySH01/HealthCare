$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'AERIX private Gmail setup' -ForegroundColor Cyan
Write-Host 'Use a dedicated Gmail account with 2-Step Verification and a Google App Password.'
$senderAddress = (Read-Host 'AERIX Gmail address [aerixcompany@gmail.com]').Trim()
if (-not $senderAddress) { $senderAddress = 'aerixcompany@gmail.com' }
try { $parsedAddress = [System.Net.Mail.MailAddress]::new($senderAddress) }
catch { throw 'Enter a valid Gmail address.' }
if ($parsedAddress.Address -ne $senderAddress -or
    -not $senderAddress.EndsWith('@gmail.com', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Enter the full dedicated @gmail.com address, without a display name.'
}
$appPassword = Read-Host 'Google App Password (hidden; not your normal password)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($appPassword)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer) -replace '\s', ''
  if ($plainPassword.Length -ne 16) { throw 'The Google App Password should contain 16 characters.' }
  $secretBytes = New-Object byte[] 32
  $rng.GetBytes($secretBytes)
  $settings = @{
    SMTP_HOST = 'smtp.gmail.com'
    SMTP_PORT = '465'
    SMTP_USER = $senderAddress
    SMTP_PASSWORD = $plainPassword
    EMAIL_FROM = "AERIX <$senderAddress>"
    EMAIL_CODE_SECRET = [Convert]::ToBase64String($secretBytes)
  }
  $encrypted = ConvertFrom-SecureString (ConvertTo-SecureString ($settings | ConvertTo-Json -Compress) -AsPlainText -Force)
  $secretDirectory = Join-Path $PSScriptRoot '.secrets'
  New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $secretDirectory 'email.dpapi'), $encrypted)
  Write-Host 'Saved encrypted for this Windows user. No password was printed.' -ForegroundColor Green
  Write-Host 'Run npm run check:email, then restart AERIX.'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $rng.Dispose()
  $appPassword.Dispose()
  $plainPassword = $null
  $settings = $null
}
