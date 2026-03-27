@echo off
setlocal
cd /d "%~dp0"

echo [BTC Monitor Electron] 프로젝트 실행기
echo.

if not exist "node_modules" (
    echo node_modules가 없습니다. 종속성 패키지를 설치합니다...
    call npm install
)

:MENU
echo.
echo ----------------------------------------
echo 1. 개발 모드 실행 (Run Dev)
echo 2. 프로젝트 빌드 (Build App)
echo 3. 종료 (Exit)
echo ----------------------------------------
set /p choice="원하시는 작업의 번호를 입력하세요: "

if "%choice%"=="1" goto DEV
if "%choice%"=="2" goto BUILD
if "%choice%"=="3" goto EXIT
echo.
echo [!] 잘못된 입력입니다. 다시 선택해주세요.
goto MENU

:DEV
echo.
echo 개발 모드를 시작합니다...
call npm run dev
pause
goto MENU

:BUILD
echo.
echo 프로젝트 빌드를 시작합니다...
call npm run build
pause
goto MENU

:EXIT
echo.
echo 프로그램을 종료합니다.
exit /b 0
