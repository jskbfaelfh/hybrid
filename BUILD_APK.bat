@echo off
title Hybrid Energy - Build APK
color 0a

echo =======================================================
echo        Hybrid Energy Android Build System
echo =======================================================
echo.
echo Checking requirements...

if exist "C:\Program Files\Android\Android Studio\jbr" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    set "PATH=C:\Program Files\Android\Android Studio\jbr\bin;%PATH%"
)

where java >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Java JDK not found!
    pause
    exit
)

cd android-app
if %errorlevel% neq 0 (
    echo [ERROR] Could not find android-app folder.
    pause
    exit
)

echo [1/2] Running Gradle to build the app...
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Check the errors above.
    cd ..
    pause
    exit
)

echo [2/2] Copying the final APK...
if not exist app\build\outputs\apk\debug\app-debug.apk (
    echo [ERROR] Cannot find the compiled APK.
    cd ..
    pause
    exit
)

cd ..
copy /y android-app\app\build\outputs\apk\debug\app-debug.apk "hybrid_energy.apk" > nul
if %errorlevel% neq 0 (
    echo [ERROR] Failed to copy the APK to the desktop folder.
    pause
    exit
)

echo.
echo =======================================================
echo [SUCCESS] The app has been built successfully!
echo You can now install "hybrid_energy.apk" on your phone.
echo =======================================================
echo.
pause
