Write-Host "Building BTC Monitor Electron for Production..." -ForegroundColor Green
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition)
Set-Location ..
npm run build
Read-Host -Prompt "Press Enter to exit"
