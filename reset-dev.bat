@echo off
REM reset-dev.bat
REM Apaga e recria o banco de desenvolvimento + roda migrations e seeds
REM Execute este script quando quiser resetar tudo para demonstração
REM Uso: clique duas vezes no arquivo ou execute no cmd: reset-dev.bat

echo.
echo ========================================
echo   Padaria do Ze — Reset do ambiente dev
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] Fazendo rollback de todas as migrations...
call npx knex migrate:rollback --all
if %errorlevel% neq 0 (
    echo ERRO no rollback. Verifique se o PostgreSQL esta rodando.
    pause
    exit /b 1
)

echo.
echo [2/3] Rodando todas as migrations...
call npx knex migrate:latest
if %errorlevel% neq 0 (
    echo ERRO nas migrations.
    pause
    exit /b 1
)

echo.
echo [3/3] Inserindo dados de demonstracao...
call npx knex seed:run
if %errorlevel% neq 0 (
    echo ERRO no seed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Concluido com sucesso!
echo   Login do dono: (93) 98800-1234
echo   Senha: admin123
echo ========================================
echo.
pause
