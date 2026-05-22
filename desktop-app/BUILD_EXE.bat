@echo off
title هايبرد إينرجي | تجميع تطبيق الديسكتوب
chcp 65001 > nul
color 0a

echo =======================================================
echo     ⚡☀️ تجميع تطبيق الديسكتوب الفاخر لنظام هايبرد إينرجي ☀️⚡
echo =======================================================
echo.

:: 1. Check Python virtual environment
if not exist "..\.venv\Scripts\python.exe" (
    echo [خطأ] لم يتم العثور على بيئة العمل الافتراضية .venv في المجلد الرئيسي!
    echo يرجى التأكد من تشغيل ملف التهيئة أولاً.
    pause
    exit /b 1
)

echo [1/4] جاري تثبيت وتحديث المكتبات المطلوبة (pywebview, pyinstaller, winotify)...
..\.venv\Scripts\python.exe -m pip install pywebview pyinstaller winotify
if %errorlevel% neq 0 (
    echo [خطأ] فشل تثبيت المكتبات المطلوبة. يرجى التحقق من اتصال الإنترنت.
    pause
    exit /b 1
)
echo [نجاح] تم تثبيت المكتبات بنجاح.
echo.

echo [2/4] جاري تنظيف مخلفات التجميع السابقة إن وجدت...
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
if exist "هايبرد_إينرجي.spec" del /q "هايبرد_إينرجي.spec"
echo.

echo [3/4] جاري تجميع التطبيق إلى ملف تنفيذي (.EXE) مستقل باستخدام PyInstaller...
echo يرجى الانتظار، قد يستغرق هذا بضع دقائق...
echo.

..\.venv\Scripts\pyinstaller.exe --noconfirm --onefile --windowed --name="هايبرد_إينرجي" --clean desktop_app.py
if %errorlevel% neq 0 (
    echo [خطأ] فشل تجميع التطبيق باستخدام PyInstaller!
    pause
    exit /b 1
)
echo [نجاح] اكتملت عملية التجميع بنجاح.
echo.

echo [4/4] جاري نقل الملف التنفيذي النهائي إلى المجلد الرئيسي للمشروع...
if not exist "dist\هايبرد_إينرجي.exe" (
    echo [خطأ] لم يتم العثور على الملف التنفيذي المجمع في مجلد dist!
    pause
    exit /b 1
)

copy /y "dist\هايبرد_إينرجي.exe" "..\هايبرد_إينرجي.exe" > nul
if %errorlevel% neq 0 (
    echo [خطأ] فشل نسخ الملف التنفيذي إلى المجلد الرئيسي!
    pause
    exit /b 1
)

echo =======================================================
echo 🎉 تم تجميع تطبيق الديسكتوب "هايبرد إينرجي" بنجاح!
echo =======================================================
echo.
echo 📁 مسار البرنامج المجمع: c:\Users\Dell\Desktop\ahmed\هايبرد_إينرجي.exe
echo.
echo 💡 تعليمات التشغيل:
echo 1. شغل خادم النظام أولاً (RUN_SYSTEM.bat).
echo 2. انقر نقراً مزدوجاً على الملف "هايبرد_إينرجي.exe" لتشغيل واجهة الديسكتوب الفاخرة.
echo 3. أدخل رابط الاتصال واحفظه للولوج التلقائي في المرات القادمة!
echo =======================================================
echo.
pause
