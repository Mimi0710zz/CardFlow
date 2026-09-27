@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title CardFlow Client - GitHub Deploy

set "PROJECT_DIR=%CD%"

:MENU
cls
echo ============================================================
echo          CARDFLOW CLIENT - GITHUB DEPLOY
echo ============================================================
echo Folder : %PROJECT_DIR%
echo.
echo   [1] Deploy len GitHub
echo       - Kiem tra Git
echo       - Chay npm run check neu co
echo       - git add / commit / push
echo       - Phu hop GitHub Pages deploy tu branch/Actions
echo.
echo   [2] Chi CHECK, KHONG deploy
echo.
echo   [3] Chay npm run deploy
echo       - Chi dung neu package.json da co script "deploy"
echo       - Thuong dung voi gh-pages
echo.
echo   [4] Xem git status
echo.
echo   [5] Thoat
echo ============================================================
choice /C 12345 /N /M "Chon [1-5]: "

set "CHOICE_RC=%ERRORLEVEL%"
if "%CHOICE_RC%"=="5" goto EXIT_OK
if "%CHOICE_RC%"=="4" goto SHOW_STATUS
if "%CHOICE_RC%"=="3" goto NPM_DEPLOY
if "%CHOICE_RC%"=="2" goto CHECK_ONLY
if "%CHOICE_RC%"=="1" goto GITHUB_DEPLOY
goto MENU

:GITHUB_DEPLOY
cls
echo ============================================================
echo CARDFLOW CLIENT - PRECHECK
echo ============================================================

where git >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Git.
    goto FAILED
)

if not exist "%CD%\.git" (
    echo [LOI] Thu muc hien tai khong phai Git repository:
    echo %CD%
    goto FAILED
)

echo.
echo [INFO] Remote Git:
git remote -v
echo.

for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if "%CURRENT_BRANCH%"=="" (
    echo [LOI] Khong xac dinh duoc branch hien tai.
    goto FAILED
)

echo Branch hien tai: %CURRENT_BRANCH%

call :RUN_OPTIONAL_CHECK
if errorlevel 1 goto FAILED

echo.
echo ============================================================
echo GIT STATUS
echo ============================================================
git status --short

echo.
choice /C YN /N /M "Tiep tuc commit + push len GitHub? [Y/N]: "
if errorlevel 2 goto CANCELLED

echo.
set "COMMIT_MSG="
set /p "COMMIT_MSG=Nhap commit message (Enter = auto): "
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=Update CardFlow Client"

echo.
echo [1/3] git add -A
git add -A
if errorlevel 1 goto FAILED

echo.
echo [2/3] git commit
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "%COMMIT_MSG%"
    if errorlevel 1 goto FAILED
) else (
    echo [INFO] Khong co thay doi moi de commit.
)

echo.
echo [3/3] git push origin %CURRENT_BRANCH%
git push origin %CURRENT_BRANCH%
if errorlevel 1 goto FAILED

goto SUCCESS_GITHUB

:CHECK_ONLY
cls
echo ============================================================
echo CARDFLOW CLIENT - CHECK ONLY
echo ============================================================
call :RUN_OPTIONAL_CHECK
if errorlevel 1 goto FAILED
echo.
echo ============================================================
echo CHECK THANH CONG
echo KHONG CO GI DUOC DEPLOY
echo ============================================================
goto FINISH

:NPM_DEPLOY
cls
echo ============================================================
echo CARDFLOW CLIENT - npm run deploy
echo ============================================================

where npm >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay npm.
    goto FAILED
)

if not exist "%CD%\package.json" (
    echo [LOI] Khong tim thay package.json.
    goto FAILED
)

powershell -NoProfile -Command "$p = Get-Content -Raw 'package.json' | ConvertFrom-Json; if ($p.scripts.deploy) { exit 0 } else { exit 1 }"
if errorlevel 1 (
    echo.
    echo [LOI] package.json khong co script "deploy".
    echo Hay dung lua chon [1] neu GitHub Pages cua anh deploy tu branch/Actions.
    goto FAILED
)

call :RUN_OPTIONAL_CHECK
if errorlevel 1 goto FAILED

echo.
choice /C YN /N /M "Chay npm run deploy? [Y/N]: "
if errorlevel 2 goto CANCELLED

echo.
npm run deploy
if errorlevel 1 goto FAILED

goto SUCCESS_NPM

:SHOW_STATUS
cls
echo ============================================================
echo GIT STATUS
echo ============================================================
where git >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Git.
    goto FAILED
)
git status
echo.
pause
goto MENU

:RUN_OPTIONAL_CHECK
if not exist "%CD%\package.json" (
    echo.
    echo [INFO] Khong co package.json - bo qua npm check.
    exit /b 0
)

where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo [LOI] Co package.json nhung khong tim thay npm.
    exit /b 1
)

if not exist "%CD%\node_modules" (
    echo.
    echo [INFO] Chua co node_modules. Dang chay npm install...
    npm install
    if errorlevel 1 exit /b 1
)

echo.
echo [INFO] Kiem tra script "check"...
powershell -NoProfile -Command "$p = Get-Content -Raw 'package.json' | ConvertFrom-Json; if ($p.scripts.check) { exit 0 } else { exit 1 }"
if errorlevel 1 (
    echo [INFO] package.json khong co script "check" - bo qua npm run check.
    exit /b 0
)

echo.
echo ============================================================
echo npm run check
echo ============================================================
npm run check
if errorlevel 1 exit /b 1

exit /b 0

:SUCCESS_GITHUB
echo.
echo ============================================================
echo PUSH GITHUB THANH CONG
echo ============================================================
echo Branch: %CURRENT_BRANCH%
echo.
echo Neu GitHub Pages dang deploy tu branch hoac GitHub Actions,
echo qua trinh publish se tu dong bat dau sau khi push.
echo.
echo Vao repository GitHub ^> Actions / Deployments de xem trang thai.
goto FINISH

:SUCCESS_NPM
echo.
echo ============================================================
echo npm run deploy THANH CONG
echo ============================================================
echo Kiem tra GitHub Pages / Deployments de xac nhan ban web moi.
goto FINISH

:CANCELLED
echo.
echo ============================================================
echo DA HUY - KHONG DEPLOY
echo ============================================================
goto FINISH

:FAILED
echo.
echo ============================================================
echo DEPLOY / CHECK THAT BAI
echo ============================================================
echo Xem thong bao loi phia tren.
goto FINISH

:FINISH
echo.
echo ============================================================
echo KET THUC
echo ============================================================
echo Cua so se KHONG tu dong tat.
echo Bam phim bat ky de dong...
pause >nul
goto EXIT_OK

:EXIT_OK
endlocal
exit /b 0
