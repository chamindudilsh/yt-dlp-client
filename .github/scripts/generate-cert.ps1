<#
.SYNOPSIS
  Generates a 10-year persistent self-signed code-signing certificate for yt-dlp Client.
.DESCRIPTION
  Creates a self-signed code-signing certificate valid for 10 years, exports:
  1. yt-dlp-client.cer (Public certificate to distribute with releases)
  2. yt-dlp-client.pfx (Private certificate for GitHub Actions signing)
  Prints the Base64 representation to copy directly into GitHub Actions Secrets.
#>

param (
  [string]$Subject = "CN=Chamindu Dilshan, O=yt-dlp Client Open Source",
  [int]$YearsValid = 10,
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " yt-dlp Client - Persistent Code Signing Certificate Tool " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Generate or prompt for password
if (-not $Password) {
  # Generate a random 24-character alphanumeric password
  $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  $rand = New-Object System.Random
  $Password = -join (1..24 | ForEach-Object { $chars[$rand.Next(0, $chars.Length)] })
  Write-Host "[1/4] Generated secure password for .pfx" -ForegroundColor Green
} else {
  Write-Host "[1/4] Using provided password for .pfx" -ForegroundColor Green
}

# 2. Create self-signed code signing certificate
Write-Host "[2/4] Generating 10-year code signing certificate in CurrentUser\My..." -ForegroundColor Yellow
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -KeyUsage DigitalSignature `
  -KeySpec Signature `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddYears($YearsValid)

Write-Host "      Created certificate: $($cert.Thumbprint)" -ForegroundColor Green

# 3. Export Public Certificate (.cer)
$cerPath = "yt-dlp-client.cer"
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
Write-Host "[3/4] Exported public certificate: $cerPath" -ForegroundColor Green

# 4. Export Private Certificate (.pfx)
$pfxPath = "yt-dlp-client.pfx"
$securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
Write-Host "[4/4] Exported private certificate: $pfxPath" -ForegroundColor Green

# 5. Encode to Base64 for GitHub Actions
$pfxBytes = [System.IO.File]::ReadAllBytes($pfxPath)
$base64 = [Convert]::ToBase64String($pfxBytes)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GitHub Actions Configuration Instructions" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Go to: Your GitHub Repository -> Settings -> Secrets and variables -> Actions -> 'New repository secret'"
Write-Host ""
Write-Host "Secret 1:" -ForegroundColor Yellow
Write-Host "Name:  WINDOWS_CERT_PASSWORD" -ForegroundColor White
Write-Host "Value: $Password" -ForegroundColor Green
Write-Host ""
Write-Host "Secret 2:" -ForegroundColor Yellow
Write-Host "Name:  WINDOWS_CERT_BASE64" -ForegroundColor White
Write-Host "Value: (Paste the base64 string below or copy from clipboard)" -ForegroundColor Green
Write-Host ""

# Copy to clipboard if on Windows interactive shell
try {
  Set-Clipboard -Value $base64
  Write-Host "Base64 string has been copied to your clipboard!" -ForegroundColor Green
} catch {
  Write-Host "Base64 length: $($base64.Length) characters"
}

# Save base64 to temporary text file (which is gitignored)
$base64File = "cert-base64.txt"
$base64 | Set-Content -Path $base64File -Encoding ascii
Write-Host "Base64 content also saved to: $base64File (do not commit this file!)" -ForegroundColor Yellow

Write-Host ""
Write-Host "Public Certificate (.cer):" -ForegroundColor Cyan
Write-Host "You can commit '$cerPath' to git or upload it to your GitHub Releases."
Write-Host "Users can double-click it -> 'Install Certificate' -> 'Local Machine' -> 'Trusted Root Certification Authorities' to eliminate all SmartScreen / Unknown Publisher warnings on their PC."
Write-Host "==========================================================" -ForegroundColor Cyan
