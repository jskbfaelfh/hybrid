@echo off
title "شمس-تك للطاقة الشمسية | نظام التشغيل"
chcp 65001 > nul
color 0b

echo =======================================================
echo     * نظام شمس-تك لإدارة تنصيب أنظمة الطاقة الشمسية *
echo =======================================================
echo.
echo جاري التحقق من متطلبات التشغيل وتجهيز بيئة العمل...
echo.

:: 1. Check Python virtual environment
set PYTHON_CMD=python
if exist ".venv\Scripts\python.exe" (
    set PYTHON_CMD=%CD%\.venv\Scripts\python.exe
    echo [نجاح] تم العثور على بيئة العمل الافتراضية venv.
) else (
    where python >nul 2>nul
    if %errorlevel% neq 0 (
        echo [خطأ] لم يتم العثور على لغة Python مثبتة على جهازك!
        echo يرجى تحميل وتثبيت Python وتفعيل خيار "Add Python to PATH" أثناء التثبيت.
        echo يمكنك تحميلها من: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo [تنبيه] لم يتم العثور على بيئة العمل الافتراضية venv، سيتم استخدام النسخة العامة من Python.
)
echo.

:: 2. Install/Update dependencies
echo [1/3] جاري تثبيت وتحديث المكتبات البرمجية اللازمة...
"%PYTHON_CMD%" -m pip install -r backend/requirements.txt >nul 2>nul
if %errorlevel% neq 0 (
    echo [تنبيه] حدثت مشكلة أثناء تحديث المكتبات تلقائياً، جاري محاولة التشغيل...
) else (
    echo [نجاح] تم التحقق من المكتبات بنجاح.
)
echo.

:: 3. Init Database
echo [2/3] جاري تهيئة قاعدة بيانات شمس-تك...
cd backend
"%PYTHON_CMD%" database.py
cd ..
echo.

:: 4. Get Local IP Address for Mobile connectivity
echo [3/3] جاري فحص الشبكة لتوفير اتصال الموبايل...
set LOCAL_IP=
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set LOCAL_IP=%%i
)
:: Trim spaces if LOCAL_IP is set
if not "%LOCAL_IP%"=="" (
    set LOCAL_IP=%LOCAL_IP: =%
)

echo =======================================================
echo * تم تجهيز النظام بنجاح وهو جاهز للعمل الآن! *
echo =======================================================
echo.
echo للفتح على هذه الحاسبة:
echo افتح المتصفح واذهب إلى الرابط: http://localhost:5000
echo.
echo للفتح من الهاتف المحمول (يجب أن يكون الهاتف متصلاً بنفس الشبكة):
echo افتح متصفح الهاتف واكتب الرابط التالي:
if "%LOCAL_IP%"=="" (
    echo [تنبيه] لم نتمكن من تحديد الآي بي المحلي تلقائياً، يرجى فحص الـ Wi-Fi.
) else (
    echo http://%LOCAL_IP%:5000
)
echo.
echo كلمة المرور الافتراضية للدخول هي: admin
echo (يمكنك تغييرها لاحقاً من صفحة الإعدادات)
echo =======================================================
echo.
echo جاري فتح المتصفح تلقائياً وتشغيل الخادم...
echo (يرجى إبقاء هذه النافذة مفتوحة أثناء استخدام البرنامج)
echo.

:: Open browser
start http://localhost:5000

:: Run flask server
cd backend
"%PYTHON_CMD%" app.py

pause
