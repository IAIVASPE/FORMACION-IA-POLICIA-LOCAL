@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Generador de datos ficticios para la practica del mapa de calor
where py >nul 2>nul && (py generar_datos.py & goto :fin)
where python >nul 2>nul && (python generar_datos.py & goto :fin)
echo.
echo No se encuentra Python en este ordenador.
echo Instalalo desde https://www.python.org/downloads/ marcando "Add python.exe to PATH"
echo y vuelve a hacer doble clic en este archivo.
pause
:fin
