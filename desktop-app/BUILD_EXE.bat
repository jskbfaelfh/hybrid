@echo off
title Hybrid Energy - Build Desktop App
chcp 65001 > nul

echo =======================================================
echo     Hybrid Energy Desktop Application Build Script
echo =======================================================
echo.

:: 1. Check Python virtual environment
if not exist "..\.venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found in main directory!
    pause
    exit /b 1
)

echo [1/4] Installing required libraries...
..\.venv\Scripts\python.exe -m pip install pyinstaller winotify Pillow PyQt5 PyQtWebEngine
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install standard dependencies.
    pause
    exit /b 1
)

..\.venv\Scripts\python.exe -m pip install pywebview --no-deps
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install pywebview.
    pause
    exit /b 1
)
echo.

echo [2/4] Cleaning up old build files...
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
if exist "هايبرد_إينرجي.spec" del /q "هايبرد_إينرجي.spec"
echo.

echo [3/4] Compiling application using PyInstaller...
..\.venv\Scripts\pyinstaller.exe --noconfirm --onefile --windowed --name="هايبرد_إينرجي" --icon="icon.ico" --clean desktop_app.py
if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller compilation failed!
    pause
    exit /b 1
)
echo.

echo [4/4] Copying final executable to project root...
if not exist "dist\هايبرد_إينرجي.exe" (
    echo [ERROR] Executable not found in dist folder!
    pause
    exit /b 1
)

copy /y "dist\هايبرد_إينرجي.exe" "..\هايبرد_إينرجي.exe" > nul
if %errorlevel% neq 0 (
    echo [ERROR] Failed to copy executable to root!
    pause
    exit /b 1
)

echo =======================================================
echo SUCCESS: Desktop application built successfully!
echo Executable is located at: ..\هايبرد_إينرجي.exe
echo =======================================================
echo.
