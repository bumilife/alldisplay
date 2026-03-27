@echo off
setlocal
cd /d "%~dp0"

echo [AllDisplay] 통합 실행기
echo.

if exist "btc-monitor-electron\run.bat" (
    echo [BTC Monitor Electron]을 실행합니다...
    cd btc-monitor-electron
    call run.bat
) else (
    echo [!] btc-monitor-electron\run.bat 파일을 찾을 수 없습니다.
    pause
)

exit /b 0
