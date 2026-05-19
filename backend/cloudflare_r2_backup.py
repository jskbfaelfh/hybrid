import os
import sqlite3
import datetime
import shutil
import urllib.request
import threading
import time
import boto3
from botocore.client import Config

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'solar_db.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def is_internet_available():
    try:
        req = urllib.request.Request(
            'http://clients3.google.com/generate_204',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        urllib.request.urlopen(req, timeout=3)
        return True
    except Exception as e:
        print(f"Internet check failed: {e}")
        return False

def upload_backup_to_r2():
    # 1. Retrieve R2 credentials from database
    conn = get_db_connection()
    r2_account_id_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_account_id'").fetchone()
    r2_access_key_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_access_key_id'").fetchone()
    r2_secret_key_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_secret_access_key'").fetchone()
    r2_bucket_name_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_bucket_name'").fetchone()
    conn.close()

    account_id = r2_account_id_row['value'] if r2_account_id_row else ''
    access_key_id = r2_access_key_row['value'] if r2_access_key_row else ''
    secret_access_key = r2_secret_key_row['value'] if r2_secret_key_row else ''
    bucket_name = r2_bucket_name_row['value'] if r2_bucket_name_row else ''

    if not all([account_id, access_key_id, secret_access_key, bucket_name]):
        return {"success": False, "error": "إعدادات Cloudflare R2 غير مكتملة. يرجى ملء كافة الحقول وحفظها."}

    if not is_internet_available():
        return {"success": False, "error": "لا يوجد اتصال بالإنترنت حالياً."}

    try:
        # Create a backup filename with timestamp
        now = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        backup_filename = f"solar_db_backup_{now}.db"
        
        # Make a temporary copy of the DB to avoid locking issues
        temp_backup_path = os.path.join(BASE_DIR, backup_filename)
        shutil.copy2(DB_PATH, temp_backup_path)

        # Connect to Cloudflare R2 using boto3 (S3 API compatible)
        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
        
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(signature_version='s3v4')
        )

        # Upload the temporary copy
        s3.upload_file(
            Filename=temp_backup_path,
            Bucket=bucket_name,
            Key=backup_filename
        )

        # Delete temporary backup file
        if os.path.exists(temp_backup_path):
            try:
                os.remove(temp_backup_path)
            except Exception:
                pass

        return {"success": True, "filename": backup_filename}

    except Exception as e:
        return {"success": False, "error": str(e)}

class BackupScheduler(threading.Thread):
    def __init__(self):
        super().__init__()
        self.daemon = True

    def run(self):
        # Wait 30 seconds after startup to let the app initialize
        time.sleep(30)
        while True:
            try:
                conn = get_db_connection()
                r2_enabled_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_backup_enabled'").fetchone()
                r2_last_backup_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_last_backup_time'").fetchone()
                conn.close()

                enabled = (r2_enabled_row['value'] == 'true') if r2_enabled_row else False

                should_backup = False
                if enabled:
                    if not r2_last_backup_row:
                        should_backup = True
                    else:
                        try:
                            # Parse last backup time
                            last_time = datetime.datetime.fromisoformat(r2_last_backup_row['value'])
                            elapsed = datetime.datetime.now() - last_time
                            if elapsed.total_seconds() >= 86400:  # 24 hours
                                should_backup = True
                        except Exception:
                            should_backup = True

                if should_backup:
                    print("Cloudflare R2 Backup: Starting automatic backup...")
                    res = upload_backup_to_r2()
                    if res.get('success'):
                        print(f"Cloudflare R2 Backup: Automatic backup successful: {res.get('filename')}")
                        conn = get_db_connection()
                        now_str = datetime.datetime.now().isoformat()
                        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('r2_last_backup_time', ?)", (now_str,))
                        conn.commit()
                        conn.close()
                    else:
                        print(f"Cloudflare R2 Backup: Automatic backup failed: {res.get('error')}")

            except Exception as e:
                print(f"Cloudflare R2 Backup: Error in scheduler loop: {e}")

            # Check every 10 minutes
            time.sleep(600)
