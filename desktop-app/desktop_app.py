import json
import os
import sys

# Top-level imports for PyInstaller to bundle them properly
try:
    from PyQt5.QtCore import QTimer
    from PyQt5.QtPrintSupport import QPrinter, QPrintDialog
except ImportError:
    pass

import webview
from winotify import Notification

# Premium dark glassmorphic HTML user interface for IP configuration
HTML_CONTENT = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>هايبرد إينرجي | إعداد الاتصال</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        
        body {
            margin: 0;
            padding: 0;
            background: radial-gradient(circle at center, #0e1624 0%, #080c14 100%);
            font-family: 'Tajawal', sans-serif;
            color: #ffffff;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            user-select: none;
        }

        /* Ambient Glow Lights */
        .glow-1 {
            position: absolute;
            width: 300px;
            height: 300px;
            background: rgba(16, 185, 129, 0.12);
            border-radius: 50%;
            filter: blur(80px);
            top: 5%;
            left: 10%;
            z-index: 1;
        }
        .glow-2 {
            position: absolute;
            width: 300px;
            height: 300px;
            background: rgba(139, 92, 246, 0.08);
            border-radius: 50%;
            filter: blur(90px);
            bottom: 5%;
            right: 10%;
            z-index: 1;
        }

        .container {
            position: relative;
            z-index: 10;
            width: 100%;
            max-width: 440px;
            padding: 20px;
        }

        /* Glassmorphic Cyberpunk Card */
        .card {
            background: rgba(14, 22, 36, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 24px;
            padding: 35px 25px;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            text-align: center;
            animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .logo {
            font-size: 60px;
            margin-bottom: 12px;
            display: inline-block;
            filter: drop-shadow(0 0 15px rgba(16, 185, 129, 0.4));
            animation: pulse 2.5s infinite ease-in-out;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.3)); }
            50% { transform: scale(1.06); filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.5)); }
        }

        h1 {
            font-size: 30px;
            font-weight: 700;
            margin: 0 0 8px 0;
            background: linear-gradient(135deg, #ffffff 30%, #a7f3d0 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtitle {
            font-size: 13px;
            color: #9ca3af;
            margin-bottom: 30px;
            line-height: 1.5;
        }

        .form-group {
            text-align: right;
            margin-bottom: 22px;
        }

        label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #9ca3af;
            margin-bottom: 8px;
            padding-right: 4px;
        }

        .input-wrapper {
            position: relative;
        }

        input {
            width: 100%;
            background: rgba(8, 12, 20, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 14px 18px;
            font-size: 15px;
            color: #ffffff;
            box-sizing: border-box;
            transition: all 0.25s ease;
            text-align: left;
            direction: ltr;
            font-family: inherit;
        }

        input:focus {
            outline: none;
            border-color: #10b981;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
            background: rgba(8, 12, 20, 0.95);
        }

        input::placeholder {
            color: #4b5563;
        }

        .error-message {
            color: #ef4444;
            font-size: 12px;
            margin-top: 8px;
            text-align: right;
            display: none;
            padding-right: 4px;
            animation: shake 0.3s ease-in-out;
        }

        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            75% { transform: translateX(4px); }
        }

        button {
            width: 100%;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            border: none;
            border-radius: 12px;
            padding: 14px;
            font-size: 16px;
            font-weight: 700;
            color: #06090e;
            cursor: pointer;
            transition: all 0.25s ease;
            box-shadow: 0 8px 15px rgba(16, 185, 129, 0.15);
            font-family: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        button:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 20px rgba(16, 185, 129, 0.25);
            background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
        }

        button:active {
            transform: translateY(0);
        }

        .footer {
            margin-top: 25px;
            font-size: 11.5px;
            color: #4b5563;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="glow-1"></div>
    <div class="glow-2"></div>
    
    <div class="container">
        <div class="card">
            <span class="logo">⚡☀️</span>
            <h1>هايبرد إينرجي</h1>
            <div class="subtitle">نظام إدارة وتنصيب أنظمة الطاقة الشمسية</div>
            
            <div class="form-group">
                <label for="url-input">رابط خادم النظام (Server URL)</label>
                <div class="input-wrapper">
                    <input type="text" id="url-input" placeholder="http://192.168.1.100:5000" value="http://localhost:5000">
                </div>
                <div class="error-message" id="error-msg"></div>
            </div>
            
            <button onclick="connectServer()">
                <span id="btn-text">حفظ والاتصال الآن 🔗</span>
            </button>
            
            <div class="footer">
                تأكد من تشغيل خادم النظام أو استخدام الرابط السحابي للوحة التحكم للولوج الفوري.
            </div>
        </div>
    </div>

    <script>
        // Check for saved URL when pywebview bridge is ready
        window.addEventListener('pywebviewready', function() {
            pywebview.api.get_saved_url().then(function(savedUrl) {
                if (savedUrl) {
                    document.getElementById('url-input').value = savedUrl;
                }
            });
        });

        function connectServer() {
            var url = document.getElementById('url-input').value.trim();
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                var err = document.getElementById('error-msg');
                err.innerText = "يرجى إدخال عنوان صحيح يبدأ بـ http:// أو https://";
                err.style.display = "block";
                return;
            }
            
            document.getElementById('error-msg').style.display = "none";
            document.getElementById('btn-text').innerText = "جاري الاتصال بالخادم...";
            
            pywebview.api.save_url(url).then(function(response) {
                if (response.status === "error") {
                    var err = document.getElementById('error-msg');
                    err.innerText = "خطأ في الاتصال: " + response.message;
                    err.style.display = "block";
                    document.getElementById('btn-text').innerText = "حفظ والاتصال الآن 🔗";
                }
            });
        }
    </script>
</body>
</html>
"""

class DesktopBridge:
    def __init__(self):
        self.window = None
        # Persistent JSON config located in the same directory as the app executable
        if getattr(sys, 'frozen', False):
            # Running as bundled EXE
            self.app_dir = os.path.dirname(sys.executable)
        else:
            # Running as Python script
            self.app_dir = os.path.dirname(os.path.abspath(__file__))
            
        self.config_path = os.path.join(self.app_dir, "config.json")
        
    def get_saved_url(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("server_url", "")
            except Exception:
                pass
        return ""
        
    def save_url(self, url):
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump({"server_url": url}, f, ensure_ascii=False, indent=4)
            # Switch view dynamically from local HTML config to the target Server URL
            self.window.load_url(url)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
            
    def show_notification(self, title, body):
        try:
            # Trigger official Windows Toast Notifications
            toast = Notification(
                app_id="هايبرد إينرجي",
                title=title,
                msg=body,
                duration="short"
            )
            toast.show()
        except Exception:
            pass
            
    def reset_server_url(self):
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump({"server_url": ""}, f, ensure_ascii=False, indent=4)
        except Exception:
            pass
        # Reload the clean local config screen HTML
        self.window.load_html(HTML_CONTENT)

    def trigger_print(self):
        try:
            QTimer.singleShot(0, self._do_print)
        except Exception as e:
            print("Error scheduling print:", e)

    def _do_print(self):
        try:
            if not self.window or not hasattr(self.window, 'native') or not self.window.native:
                return
            
            webview_widget = self.window.native.webview
            page = webview_widget.page()
            
            printer = QPrinter(QPrinter.HighResolution)
            dialog = QPrintDialog(printer, self.window.native)
            dialog.setWindowTitle("طباعة - هايبرد إينرجي")
            if dialog.exec_() == QPrintDialog.Accepted:
                page.print(printer, lambda success: print(f"Printing finished with status: {success}"))
        except Exception as e:
            print("Error in _do_print:", e)


def setup_printing(window):
    if hasattr(window, 'native') and window.native:
        if not hasattr(window, '_print_setup_done'):
            window._print_setup_done = True
            try:
                page = window.native.webview.page()
                page.printRequested.connect(lambda: window.pywebview.api.trigger_print())
            except Exception as e:
                print("Failed to connect native printRequested signal:", e)


def on_loaded(window):
    # Setup native printing connections
    setup_printing(window)

    # Auto inject HTML5 Notification API wrapper/shim
    # This maps dashboard notifications to the Python/Windows native toast bridge
    # And exposes window.resetServerUrl() to easily log out or change IP
    # And overrides window.print to use the DesktopBridge printing function
    js_shim = """
    (function() {
        if (!window.Notification || window.Notification.permission !== 'granted') {
            window.Notification = function(title, options) {
                if (window.pywebview && window.pywebview.api) {
                    window.pywebview.api.show_notification(title, options ? options.body : "");
                }
            };
            window.Notification.permission = "granted";
            window.Notification.requestPermission = function() {
                return Promise.resolve("granted");
            };
        }
        
        window.resetServerUrl = function() {
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.reset_server_url();
            }
        };

        window.print = function() {
            if (window.pywebview && window.pywebview.api && window.pywebview.api.trigger_print) {
                window.pywebview.api.trigger_print();
            }
        };
    })();
    """
    window.evaluate_js(js_shim)

def main():
    bridge = DesktopBridge()
    saved_url = bridge.get_saved_url()
    
    # Initialize PyWebView window
    # If the server URL is saved, boot into dashboard. Otherwise boot into config setup.
    if saved_url:
        window = webview.create_window(
            title="هايبرد إينرجي | لوحة التحكم",
            url=saved_url,
            js_api=bridge,
            width=1280,
            height=800,
            min_size=(1020, 650)
        )
    else:
        window = webview.create_window(
            title="هايبرد إينرجي | إعداد الاتصال",
            html=HTML_CONTENT,
            js_api=bridge,
            width=1000,
            height=650,
            resizable=True
        )
        
    bridge.window = window
    
    # Bind WebView load finish event to automatically inject our bridge script
    window.events.loaded += lambda: on_loaded(window)
    
    # Start PyWebView loop (automatically hooks into Windows Edge WebView2/Chromium)
    webview.start(gui='qt', debug=False)

if __name__ == "__main__":
    main()
