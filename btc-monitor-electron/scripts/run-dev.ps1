Write-Host "Starting BTC Monitor Electron in Development Mode..." -ForegroundColor Green
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition)
Set-Location ..
npm run dev
Read-Host -Prompt "Press Enter to exit"
