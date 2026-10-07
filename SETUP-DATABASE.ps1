$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'AERIX private database setup' -ForegroundColor Cyan
Write-Host 'Enter the DATABASE user from Atlas, not your MongoDB website login.'
$databaseUser = Read-Host 'Database username'
if ([string]::IsNullOrWhiteSpace($databaseUser)) { throw 'A username is required.' }
$databasePassword = Read-Host 'Database password (hidden)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($databasePassword)
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  if ([string]::IsNullOrEmpty($plainPassword)) { throw 'A password is required.' }
  $connectionUri = 'mongodb+srv://' + [Uri]::EscapeDataString($databaseUser) + ':' + [Uri]::EscapeDataString($plainPassword) + '@cluster0.1uc195x.mongodb.net/aerix?retryWrites=true&w=majority&appName=AERIX'
  $encryptedUri = ConvertFrom-SecureString (ConvertTo-SecureString $connectionUri -AsPlainText -Force)
  $secretDirectory = Join-Path $PSScriptRoot '.secrets'
  New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $secretDirectory 'mongodb.dpapi'), $encryptedUri)
  Write-Host 'Saved encrypted for this Windows user. Your password was not printed.' -ForegroundColor Green
  Write-Host 'Run npm run check:database to check the connection. Restart AERIX after a successful check.'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $plainPassword = $null; $connectionUri = $null
  $databasePassword.Dispose()
}
