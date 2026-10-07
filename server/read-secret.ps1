param([Parameter(Mandatory=$true)][string]$SecretFile)
$ErrorActionPreference = 'Stop'
$secureValue = ConvertTo-SecureString ([IO.File]::ReadAllText($SecretFile))
$valuePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
try { Write-Output ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($valuePointer)) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($valuePointer); $secureValue.Dispose() }
