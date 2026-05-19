import os
import sqlite3
import datetime
import shutil
import urllib.request
import threading
import time
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/drive.file']

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BASE_DIR, 'credentials.json')
TOKEN_PATH = os.path.join(BASE_DIR, 'token.json')
DB_PATH = os.path.join(BASE_DIR, 'solar_db.db')

def get_db_connection():
    # Helper to prevent circular imports if needed
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def is_internet_available():
    try:
        urllib.request.urlopen('https://www.google.com', timeout=3)
        return True
    except Exception:
        return False

def get_credentials():
    creds = None
    if os.path.exists(TOKEN_PATH):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
        except Exception:
            creds = None
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                with open(TOKEN_PATH, 'w') as token:
                    token.write(creds.to_json())
            except Exception:
                creds = None
        else:
            creds = None
    return creds

def start_auth_flow():
    if not os.path.exists(CREDENTIALS_PATH):
        raise FileNotFoundError("يرجى رفع ملف credentials.json أولاً لتتمكن من ربط الحساب.")
    
    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
    creds = flow.run_local_server(port=0)
    with open(TOKEN_PATH, 'w') as token:
        token.write(creds.to_json())
    return creds

def upload_backup_to_drive():
    creds = get_credentials()
    if not creds:
        return {"success": False, "error": "Google Drive غير مرتبط أو انتهت صلاحية الجلسة. يرجى إعادة الاتصال."}
    
    if not is_internet_available():
        return {"success": False, "error": "لا يوجد اتصال بالإنترنت حالياً."}
        
    try:
        service = build('drive', 'v3', credentials=creds)
        
        # Create a backup filename with timestamp
        now = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        backup_filename = f"solar_db_backup_{now}.db"
        
        # Make a temporary copy of the DB to avoid locking issues
        temp_backup_path = os.path.join(BASE_DIR, backup_filename)
        shutil.copy2(DB_PATH, temp_backup_path)
        
        # Check if a folder named 'ShamsTek_Backups' exists on Drive
        folder_id = None
        results = service.files().list(
            q="name = 'ShamsTek_Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            spaces='drive',
            fields="files(id)"
        ).execute()
        files = results.get('files', [])
        
        if files:
            folder_id = files[0]['id']
        else:
            # Create the folder
            file_metadata = {
                'name': 'ShamsTek_Backups',
                'mimeType': 'application/vnd.google-apps.folder'
            }
            folder = service.files().create(body=file_metadata, fields='id').execute()
            folder_id = folder.get('id')
            
        # Upload the file
        file_metadata = {
            'name': backup_filename,
            'parents': [folder_id] if folder_id else []
        }
        media = MediaFileUpload(temp_backup_path, mimetype='application/x-sqlite3', resumable=True)
        uploaded_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        # Delete temporary backup file
        if os.path.exists(temp_backup_path):
            try:
                os.remove(temp_backup_path)
            except Exception:
                pass
            
        return {"success": True, "file_id": uploaded_file.get('id'), "filename": backup_filename}
        
    except Exception as e:
        return {"success": False, "error": str(e)}

class BackupScheduler(threading.Thread):
    def __init__(self):
        super().__init__()
        self.daemon = True
        
    def run(self):
        # Wait 30 seconds after startup before checking to let the app initialize
        time.sleep(30)
        while True:
            try:
                conn = get_db_connection()
                # Create drive backup settings key if not exists
                drive_enabled_row = conn.execute("SELECT value FROM settings WHERE key = 'drive_backup_enabled'").fetchone()
                drive_last_backup_row = conn.execute("SELECT value FROM settings WHERE key = 'drive_last_backup_time'").fetchone()
                conn.close()
                
                enabled = (drive_enabled_row['value'] == 'true') if drive_enabled_row else False
                
                should_backup = False
                if enabled:
                    if not drive_last_backup_row:
                        should_backup = True
                    else:
                        try:
                            last_time = datetime.datetime.fromisoformat(drive_last_backup_row['value'])
                            elapsed = datetime.datetime.now() - last_time
                            if elapsed.total_seconds() >= 86400:  # 24 hours
                                should_backup = True
                        except Exception:
                            should_backup = True
                            
                if should_backup:
                    print("Google Drive Backup: Starting automatic backup...")
                    res = upload_backup_to_drive()
                    if res.get('success'):
                        print(f"Google Drive Backup: Automatic backup successful: {res.get('filename')}")
                        conn = get_db_connection()
                        now_str = datetime.datetime.now().isoformat()
                        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('drive_last_backup_time', ?)", (now_str,))
                        conn.commit()
                        conn.close()
                    else:
                        print(f"Google Drive Backup: Automatic backup failed: {res.get('error')}")
            except Exception as e:
                print(f"Google Drive Backup: Error in scheduler loop: {e}")
                
            # Check every 10 minutes
            time.sleep(600)
