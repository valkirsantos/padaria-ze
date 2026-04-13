@echo off
REM iniciar-dev.bat
REM Abre dois terminais: um para o backend e um para o frontend
REM Execute este script para iniciar todo o ambiente de desenvolvimento
REM Uso: clique duas vezes no arquivo

echo.
echo ========================================
echo   Padaria do Ze — Iniciando ambiente dev
echo ========================================
echo.

REM Abre o backend em uma nova janela do cmd
start "Backend - Padaria do Ze" cmd /k "cd /d "%~dp0backend" && npm run dev"

REM Aguarda 3 segundos para o backend inicializar antes de abrir o frontend
timeout /t 3 /nobreak > nul

REM Abre o frontend em outra janela do cmd
start "Frontend - Padaria do Ze" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Aguarde alguns segundos e acesse:
echo.
echo   PWA do cliente:  http://localhost:5173
echo   Painel do dono:  http://localhost:5173/dono/login
echo   API backend:     http://localhost:3001/health
echo.
echo Pressione qualquer tecla para fechar esta janela.
pause > nul
