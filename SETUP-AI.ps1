$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'AERIX private OpenAI API setup' -ForegroundColor Cyan
Write-Host 'Create an API key in your own OpenAI API project. Your ChatGPT sign-in is not an API key.'
$apiKey = Read-Host 'OpenAI API key (hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ($plain.Length -lt 25 -or -not $plain.StartsWith('sk-') -or $plain -match '\s') {
    throw 'That does not look like a complete OpenAI API key. Nothing was saved.'
  }
  $secretDirectory = Join-Path $PSScriptRoot '.secrets'
  New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $secretDirectory 'openai.dpapi'), (ConvertFrom-SecureString $apiKey))
  Write-Host 'Saved encrypted for this Windows user. Your key was not printed.' -ForegroundColor Green
  Write-Host 'Run npm run check:ai, then restart AERIX.'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $plain = $null
  $apiKey.Dispose()
}
