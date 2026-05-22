import os
import sqlite3
from dotenv import load_dotenv
load_dotenv()
import datetime
from dateutil.relativedelta import relativedelta
from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
from werkzeug.utils import secure_filename

try:
    from backend.database import init_db, get_db_connection
    from backend.cloudflare_r2_backup import (
        upload_backup_to_r2,
        BackupScheduler
    )
except ImportError:
    from database import init_db, get_db_connection
    from cloudflare_r2_backup import (
        upload_backup_to_r2,
        BackupScheduler
    )

# Configure Flask to load templates and static files from the frontend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))

app = Flask(__name__, 
            static_folder=FRONTEND_DIR, 
            static_url_path='/static',
            template_folder=FRONTEND_DIR)

app.secret_key = os.environ.get('SECRET_KEY', 'default_secret')

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

from apscheduler.schedulers.background import BackgroundScheduler
import datetime

def update_overdue_installments():
    with app.app_context():
        today = datetime.datetime.now().strftime('%Y-%m-%d')
        query_db("UPDATE installments SET status = 'Overdue' WHERE status = 'Unpaid' AND due_date < ?", (today,))

try:
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=update_overdue_installments, trigger="interval", hours=24)
    scheduler.start()
except Exception as e:
    print(f"Failed to start scheduler: {e}")

UPLOAD_FOLDER = os.path.join(FRONTEND_DIR, 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB max upload

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/favicon.ico')
def favicon():
    return '', 204

# Initialize DB on startup
with app.app_context():
    init_db()

from flask import g

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = get_db_connection()
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# Custom JSON helper
def query_db(query, args=(), one=False):
    db = get_db()
    cur = db.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    db.commit()
    return (rv[0] if rv else None) if one else rv

# Authentication Decorator / Helper
def is_authenticated():
    if request.headers.get('X-App-Token') == 'hybrid_mobile_secret_2026':
        return True
    return session.get('logged_in', False)

# ----------------- UI ROUTE -----------------
@app.route('/')
def index():
    conn = get_db_connection()
    company_name_row = conn.execute("SELECT value FROM settings WHERE key = 'company_name'").fetchone()
    company_logo_row = conn.execute("SELECT value FROM settings WHERE key = 'company_logo'").fetchone()
    engineer_name_row = conn.execute("SELECT value FROM settings WHERE key = 'engineer_name'").fetchone()
    conn.close()
    
    company_name = company_name_row['value'] if company_name_row else 'هايبرد إينرجي للطاقة الشمسية'
    company_logo = company_logo_row['value'] if company_logo_row else ''
    engineer_name = engineer_name_row['value'] if engineer_name_row else 'أحمد علي'
    
    if not is_authenticated():
        return render_template('login.html', company_name=company_name, company_logo=company_logo)
    return render_template(
        'index.html', 
        company_name=company_name, 
        company_logo=company_logo,
        engineer_name=engineer_name
    )

# ----------------- PUBLIC SETTINGS API -----------------
@app.route('/api/public/settings', methods=['GET'])
def get_public_settings():
    conn = get_db_connection()
    company_name_row = conn.execute("SELECT value FROM settings WHERE key = 'company_name'").fetchone()
    company_logo_row = conn.execute("SELECT value FROM settings WHERE key = 'company_logo'").fetchone()
    conn.close()
    
    return jsonify({
        'company_name': company_name_row['value'] if company_name_row else 'هايبرد إينرجي للطاقة الشمسية',
        'company_logo': company_logo_row['value'] if company_logo_row else ''
    })

# ----------------- AUTHENTICATION API -----------------
@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")
def api_login():
    data = request.json or {}
    password = data.get('password')
    
    # Retrieve stored password
    stored = query_db('SELECT value FROM settings WHERE key = ?', ('admin_password',), one=True)
    stored_password = stored['value'] if stored else 'admin'
    
    from werkzeug.security import check_password_hash, generate_password_hash
    # Backward compatibility: if it is still plain 'admin', check normally
    if stored_password == 'admin' and password == 'admin':
        session['logged_in'] = True
        return jsonify({'success': True, 'message': 'Logged in successfully'})
        
    if not stored_password.startswith('scrypt:') and not stored_password.startswith('pbkdf2:'):
        if password == stored_password:
            # Upgrade their password to hash seamlessly
            hashed = generate_password_hash(password)
            query_db('UPDATE settings SET value = ? WHERE key = ?', (hashed, 'admin_password'))
            session['logged_in'] = True
            return jsonify({'success': True, 'message': 'Logged in successfully'})
    
    if check_password_hash(stored_password, password):
        session['logged_in'] = True
        return jsonify({'success': True, 'message': 'Logged in successfully'})
    return jsonify({'success': False, 'message': 'كلمة المرور غير صحيحة'}), 401
@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.pop('logged_in', None)
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/api/check_auth', methods=['GET'])
def check_auth():
    return jsonify({'authenticated': is_authenticated()})

# ----------------- CUSTOMER ID AUTO-GENERATION -----------------
def get_next_customer_id():
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT id FROM customers WHERE id LIKE 'SH-%'").fetchall()
    conn.close()
    
    max_num = 1000  # Start base
    for r in rows:
        val = r['id']
        try:
            num = int(val.split('-')[1])
            if num > max_num:
                max_num = num
        except (IndexError, ValueError):
            pass
            
    return f"SH-{max_num + 1}"

@app.route('/api/customers/next-id', methods=['GET'])
def get_next_id():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({'next_id': get_next_customer_id()})

# ----------------- SYNC (OFFLINE APP) ENDPOINTS -----------------
@app.route('/api/sync/export', methods=['GET'])
def sync_export():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Export all necessary tables for offline mobile usage
    data = {
        'customers': [dict(row) for row in cursor.execute("SELECT * FROM customers").fetchall()],
        'financial_status': [dict(row) for row in cursor.execute("SELECT * FROM financial_status").fetchall()],
        'installments': [dict(row) for row in cursor.execute("SELECT * FROM installments").fetchall()],
        'customer_components': [dict(row) for row in cursor.execute("SELECT * FROM customer_components").fetchall()],
        'inventory_items': [dict(row) for row in cursor.execute("SELECT * FROM inventory_items").fetchall()],
        'company_settings': [dict(row) for row in cursor.execute("SELECT * FROM company_settings").fetchall()],
        'company_expenses': [dict(row) for row in cursor.execute("SELECT * FROM company_expenses").fetchall()],
        'settings_lists': [dict(row) for row in cursor.execute("SELECT * FROM settings_lists").fetchall()]
    }
    conn.close()
    return jsonify(data)

# ----------------- CUSTOMER API -----------------
@app.route('/api/customers', methods=['GET'])
def get_customers():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
    
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 1000, type=int)
    offset = (page - 1) * limit
    
    rows = query_db('SELECT * FROM customers ORDER BY created_at DESC LIMIT ? OFFSET ?', (limit, offset))
    customers = []
    for r in rows:
        c = dict(r)
        # Fetch components count and financial summary
        fin = query_db('SELECT * FROM financial_status WHERE customer_id = ?', (c['id'],), one=True)
        c['financials'] = dict(fin) if fin else None
        
        comps = query_db('SELECT COUNT(*) as count FROM customer_components WHERE customer_id = ?', (c['id'],), one=True)
        c['components_count'] = comps['count'] if comps else 0
        customers.append(c)
        
    return jsonify(customers)

@app.route('/api/customers', methods=['POST'])
def add_customer():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json or {}
    cust_id = data.get('id')  # Fixed Unique ID e.g. SH-1001
    if not cust_id or cust_id.strip() == '' or cust_id == 'AUTO':
        cust_id = get_next_customer_id()
    else:
        cust_id = cust_id.strip().upper()
        
    name = data.get('name')
    phone = data.get('phone')
    address = data.get('address', '')
    installation_date = data.get('installation_date', '')
    sale_type = data.get('sale_type', 'Cash')
    notes = data.get('notes', '')
    installation_method = data.get('installation_method', '')
    gps_link = data.get('gps_link', '')
    
    total_price = float(data.get('total_price', 0))
    down_payment = float(data.get('down_payment', 0))
    total_installments = int(data.get('total_installments', 0))
    
    if not cust_id or not name or not phone:
        return jsonify({'error': 'الاسم، الهاتف والرقم التعريفي مطلوبين'}), 400
        
    # Check if ID already exists
    exists = query_db('SELECT id FROM customers WHERE id = ?', (cust_id,), one=True)
    if exists:
        return jsonify({'error': f'الرقم التعريفي {cust_id} موجود مسبقاً، يرجى اختيار رقم آخر'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO customers (id, name, phone, address, installation_date, sale_type, notes, installation_method, gps_link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (cust_id, name, phone, address, installation_date, sale_type, notes, installation_method, gps_link))
        
        if total_price > 0:
            remaining_balance = total_price - down_payment
            cursor.execute('''
                INSERT INTO financial_status (customer_id, total_price, down_payment, remaining_balance, total_installments)
                VALUES (?, ?, ?, ?, ?)
            ''', (cust_id, total_price, down_payment, remaining_balance, total_installments))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم إضافة العميل بنجاح', 'id': cust_id})

@app.route('/api/customers/<id>', methods=['GET'])
def get_customer(id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    cust = query_db('SELECT * FROM customers WHERE id = ?', (id,), one=True)
    if not cust:
        return jsonify({'error': 'العميل غير موجود'}), 404
        
    c = dict(cust)
    
    # Financial details
    fin = query_db('SELECT * FROM financial_status WHERE customer_id = ?', (id,), one=True)
    c['financials'] = dict(fin) if fin else None
    
    # Installments list
    insts = query_db('SELECT * FROM installments WHERE customer_id = ? ORDER BY installment_number ASC', (id,))
    c['installments'] = [dict(i) for i in insts]
    
    # Solar components list
    comps = query_db('SELECT * FROM customer_components WHERE customer_id = ?', (id,))
    c['components'] = [dict(comp) for comp in comps]
    
    # Documents / Photos list
    docs = query_db('SELECT * FROM documents WHERE customer_id = ? ORDER BY upload_date DESC', (id,))
    c['documents'] = [dict(d) for d in docs]
    
    return jsonify(c)

@app.route('/api/customers/<id>/status', methods=['PUT'])
def update_system_status(id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    new_status = data.get('system_status')
    
    if new_status not in ['مكتمل', 'قيد التنفيذ']:
        return jsonify({'error': 'حالة غير صالحة'}), 400
        
    conn = get_db_connection()
    try:
        conn.execute('UPDATE customers SET system_status = ? WHERE id = ?', (new_status, id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم تحديث حالة النظام بنجاح'})

@app.route('/api/customers/<id>', methods=['PUT'])
def update_customer(id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    name = data.get('name')
    phone = data.get('phone')
    address = data.get('address', '')
    installation_date = data.get('installation_date', '')
    sale_type = data.get('sale_type')
    notes = data.get('notes', '')
    installation_method = data.get('installation_method', '')
    gps_link = data.get('gps_link', '')
    
    if not name or not phone:
        return jsonify({'error': 'الاسم والهاتف مطلوبان'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE customers
            SET name = ?, phone = ?, address = ?, installation_date = ?, sale_type = ?, notes = ?, installation_method = ?, gps_link = ?
            WHERE id = ?
        ''', (name, phone, address, installation_date, sale_type, notes, installation_method, gps_link, id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم تحديث بيانات العميل بنجاح'})

@app.route('/api/customers/<id>', methods=['DELETE'])
def delete_customer(id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Cascade delete is configured, but let's delete manually to be safe on SQLite
        cursor.execute('DELETE FROM customers WHERE id = ?', (id,))
        cursor.execute('DELETE FROM financial_status WHERE customer_id = ?', (id,))
        cursor.execute('DELETE FROM installments WHERE customer_id = ?', (id,))
        cursor.execute('DELETE FROM customer_components WHERE customer_id = ?', (id,))
        cursor.execute('DELETE FROM documents WHERE customer_id = ?', (id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم حذف العميل وكافة بياناته المربوطة بنجاح'})

# ----------------- CUSTOMER COMPONENTS API -----------------
@app.route('/api/customers/<id>/components', methods=['POST'])
def add_component(id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    name = data.get('component_name')
    qty = int(data.get('quantity', 1))
    unit_price = float(data.get('unit_price', 0.0))
    warranty = data.get('warranty_period', '')
    cost_price = float(data.get('cost_price', 0.0))
    component_type = data.get('component_type', 'Primary')
    sourcing_type = data.get('sourcing_type', 'Stock')
    
    if not name:
        return jsonify({'error': 'اسم القطعة مطلوب'}), 400
        
    total_price = qty * unit_price
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if sourcing_type == 'Stock':
            # Check inventory
            inv_item = cursor.execute('SELECT * FROM inventory_items WHERE item_name = ?', (name,)).fetchone()
            if not inv_item:
                return jsonify({'error': f'المادة "{name}" غير موجودة في المخزن'}), 400
            
            if inv_item['quantity_on_hand'] < qty:
                return jsonify({'error': f'الكمية المطلوبة ({qty}) غير متوفرة في المخزن. المتاح حالياً: {inv_item["quantity_on_hand"]}'}), 400
                
            # Decrement inventory stock
            cursor.execute('UPDATE inventory_items SET quantity_on_hand = quantity_on_hand - ? WHERE id = ?', (qty, inv_item['id']))
            # Log transaction
            cursor.execute('''
                INSERT INTO inventory_transactions (item_id, transaction_type, quantity, related_customer, notes)
                VALUES (?, ?, ?, ?, ?)
            ''', (inv_item['id'], 'سحب وتركيب للعميل', qty, id, 'تنصيب ضمن مكونات المنظومة الأساسية/الثانوية'))
            
        cursor.execute('''
            INSERT INTO customer_components (customer_id, component_name, quantity, unit_price, total_price, warranty_period, cost_price, component_type, sourcing_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (id, name, qty, unit_price, total_price, warranty, cost_price, component_type, sourcing_type))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم إضافة القطعة لنظام العميل'})

@app.route('/api/components/<int:comp_id>', methods=['PUT'])
def update_component(comp_id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    name = data.get('component_name')
    qty = int(data.get('quantity', 1))
    warranty = data.get('warranty_period', 'بدون ضمان')
    cost_price = float(data.get('cost_price', 0.0))
    component_type = data.get('component_type', 'Primary')
    sourcing_type = data.get('sourcing_type', 'Stock')
    
    if not name or qty <= 0:
        return jsonify({'error': 'بيانات غير صالحة'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check old comp
        old_comp = cursor.execute('SELECT * FROM customer_components WHERE id = ?', (comp_id,)).fetchone()
        if not old_comp:
            return jsonify({'error': 'القطعة غير موجودة'}), 404
        
        # If Stock logic was used previously, it's too complex to reverse and re-apply for edits in a simple way
        # Since it's an edit, we just update the text fields
        cursor.execute('''
            UPDATE customer_components 
            SET component_name = ?, quantity = ?, warranty_period = ?, cost_price = ?, component_type = ?, sourcing_type = ?
            WHERE id = ?
        ''', (name, qty, warranty, cost_price, component_type, sourcing_type, comp_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم تحديث القطعة بنجاح'})


@app.route('/api/components/<int:comp_id>', methods=['DELETE'])
def delete_component(comp_id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        comp = cursor.execute('SELECT * FROM customer_components WHERE id = ?', (comp_id,)).fetchone()
        if not comp:
            return jsonify({'error': 'القطعة غير موجودة'}), 404
            
        comp_dict = dict(comp)
        sourcing = comp_dict.get('sourcing_type', 'Stock')
        name = comp_dict.get('component_name')
        qty = comp_dict.get('quantity', 0)
        
        if sourcing == 'Stock':
            # Restore stock in inventory
            inv_item = cursor.execute('SELECT id FROM inventory_items WHERE item_name = ?', (name,)).fetchone()
            if inv_item:
                cursor.execute('UPDATE inventory_items SET quantity_on_hand = quantity_on_hand + ? WHERE id = ?', (qty, inv_item['id']))
                cursor.execute('''
                    INSERT INTO inventory_transactions (item_id, transaction_type, quantity, related_customer, notes)
                    VALUES (?, ?, ?, ?, ?)
                ''', (inv_item['id'], 'استرجاع للمخزن (إلغاء تنصيب)', qty, comp_dict['customer_id'], 'تم حذف المادة من منظومة العميل ورجوعها للمخزن'))
        cursor.execute('DELETE FROM customer_components WHERE id = ?', (comp_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم حذف القطعة بنجاح'})

# ----------------- FINANCIALS & INSTALLMENTS API -----------------
@app.route('/api/customers/<id>/financials', methods=['POST', 'PUT'])
def save_financials(id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    total_price = float(data.get('total_price', 0))
    down_payment = float(data.get('down_payment', 0))
    total_installments = int(data.get('total_installments', 0))
    
    remaining_balance = total_price - down_payment
    if remaining_balance < 0:
        return jsonify({'error': 'الدفعة الأولى لا يمكن أن تكون أكبر من المبلغ الكلي'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if already exists
        exists = cursor.execute('SELECT id FROM financial_status WHERE customer_id = ?', (id,)).fetchone()
        
        if exists:
            cursor.execute('''
                UPDATE financial_status
                SET total_price = ?, down_payment = ?, remaining_balance = ?, total_installments = ?
                WHERE customer_id = ?
            ''', (total_price, down_payment, remaining_balance, total_installments, id))
        else:
            cursor.execute('''
                INSERT INTO financial_status (customer_id, total_price, down_payment, remaining_balance, total_installments)
                VALUES (?, ?, ?, ?, ?)
            ''', (id, total_price, down_payment, remaining_balance, total_installments))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم حفظ البيانات المالية بنجاح'})

@app.route('/api/customers/<id>/generate-installments', methods=['POST'])
def generate_installments(id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    start_date = data.get('start_date')  # YYYY-MM-DD
    
    if not start_date:
        return jsonify({'error': 'تاريخ أول قسط مطلوب'}), 400
        
    fin = query_db('SELECT * FROM financial_status WHERE customer_id = ?', (id,), one=True)
    if not fin:
        return jsonify({'error': 'يرجى حفظ البيانات المالية للعميل أولاً'}), 400
        
    remaining = fin['remaining_balance']
    count = fin['total_installments']
    
    if count <= 0:
        return jsonify({'error': 'عدد الأقساط يجب أن يكون أكبر من 0'}), 400
        
    # Calculate equal installments
    installment_amount = round(remaining / count, 2)
    
    
    try:
        base_date = datetime.datetime.strptime(start_date, '%Y-%m-%d')
    except ValueError:
        return jsonify({'error': 'صيغة التاريخ غير صحيحة، يجب أن تكون YYYY-MM-DD'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Clear existing unpaid and overdue installments
        cursor.execute("DELETE FROM installments WHERE customer_id = ? AND status IN ('Unpaid', 'Overdue')", (id,))
        
        # Check if they have already paid installments to not overwrite paid ones
        paid_count = cursor.execute("SELECT COUNT(*) as count FROM installments WHERE customer_id = ? AND status = 'Paid'", (id,)).fetchone()['count']
        
        for i in range(paid_count, count):
            due_date = base_date + relativedelta(months=i)
            cursor.execute('''
                INSERT INTO installments (customer_id, installment_number, amount, due_date, status)
                VALUES (?, ?, ?, ?, 'Unpaid')
            ''', (id, i + 1, installment_amount, due_date.strftime('%Y-%m-%d')))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم توليد جدول الأقساط تلقائياً'})

@app.route('/api/installments/<int:inst_id>', methods=['PUT'])
def edit_installment(inst_id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    amount = float(data.get('amount'))
    due_date = data.get('due_date')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE installments
            SET amount = ?, due_date = ?
            WHERE id = ?
        ''', (amount, due_date, inst_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم تعديل القسط بنجاح'})

@app.route('/api/installments/<int:inst_id>/pay', methods=['POST'])
def pay_installment(inst_id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    paid_date = data.get('paid_date') # YYYY-MM-DD
    
    if not paid_date:
        import datetime
        paid_date = datetime.date.today().strftime('%Y-%m-%d')
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE installments
            SET status = 'Paid', paid_date = ?
            WHERE id = ?
        ''', (paid_date, inst_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم تسجيل تسديد القسط وتوليد الوصل'})

# ----------------- EXPENSES API -----------------
@app.route('/api/expenses', methods=['GET', 'POST'])
def handle_expenses():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    if request.method == 'GET':
        rows = query_db('''
            SELECT e.*, c.name as customer_name
            FROM company_expenses e
            LEFT JOIN customers c ON e.customer_id = c.id
            ORDER BY e.expense_date DESC
        ''')
        return jsonify([dict(r) for r in rows])
        
    # POST - Add new expense
    data = request.json or {}
    item_name = data.get('item_name')
    category = data.get('category')
    amount = float(data.get('amount', 0))
    expense_date = data.get('expense_date')
    notes = data.get('notes', '')
    customer_id = data.get('customer_id')
    if not customer_id or customer_id == '':
        customer_id = None
    
    if not item_name or not category or amount <= 0 or not expense_date:
        return jsonify({'error': 'يرجى ملء كافة الحقول الأساسية'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO company_expenses (item_name, category, amount, expense_date, notes, customer_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (item_name, category, amount, expense_date, notes, customer_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم إضافة المصروف بنجاح'})

@app.route('/api/expenses/<int:exp_id>', methods=['DELETE'])
def delete_expense(exp_id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM company_expenses WHERE id = ?', (exp_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم حذف المصروف'})

# ----------------- SIMPLE INVENTORY API -----------------
@app.route('/api/inventory', methods=['GET', 'POST'])
def handle_inventory():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    if request.method == 'GET':
        rows = query_db('SELECT * FROM inventory_items ORDER BY item_name ASC')
        return jsonify([dict(r) for r in rows])
        
    # POST - Add new or Add stock
    data = request.json or {}
    item_name = data.get('item_name')
    category = data.get('item_category', 'Other')
    qty = int(data.get('quantity_on_hand', 0))
    min_threshold = int(data.get('min_threshold', 5))
    cost_price = float(data.get('cost_price', 0.0))
    notes = data.get('notes', '')
    
    if not item_name:
        return jsonify({'error': 'اسم المادة مطلوب'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        exists = cursor.execute('SELECT id, quantity_on_hand FROM inventory_items WHERE item_name = ?', (item_name,)).fetchone()
        if exists:
            # If exists, we ADD to stock
            new_qty = exists['quantity_on_hand'] + qty
            cursor.execute('''
                UPDATE inventory_items
                SET quantity_on_hand = ?, cost_price = ?, min_threshold = ?, notes = ?
                WHERE id = ?
            ''', (max(0, new_qty), cost_price, min_threshold, notes, exists['id']))
            item_id = exists['id']
            # Log transaction
            if qty != 0:
                trans_type = 'إضافة للمخزن' if qty > 0 else 'سحب وتعديل مباشر'
                cursor.execute('INSERT INTO inventory_transactions (item_id, transaction_type, quantity, notes) VALUES (?, ?, ?, ?)', (item_id, trans_type, abs(qty), 'تعديل مباشر من المخزن'))
        else:
            cursor.execute('''
                INSERT INTO inventory_items (item_name, item_category, quantity_on_hand, min_threshold, cost_price, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (item_name, category, qty, min_threshold, cost_price, notes))
            item_id = cursor.lastrowid
            if qty > 0:
                cursor.execute('INSERT INTO inventory_transactions (item_id, transaction_type, quantity, notes) VALUES (?, ?, ?, ?)', (item_id, 'إضافة للمخزن', qty, 'إضافة مادة لأول مرة'))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم تحديث المخزون بنجاح'})

@app.route('/api/inventory/transactions', methods=['GET'])
def get_inventory_transactions():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
    rows = query_db('''
        SELECT t.*, i.item_name 
        FROM inventory_transactions t
        JOIN inventory_items i ON t.item_id = i.id
        ORDER BY t.transaction_date DESC
        LIMIT 100
    ''')
    return jsonify([dict(r) for r in rows])

@app.route('/api/inventory/<int:item_id>', methods=['DELETE'])
def delete_inventory_item(item_id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM inventory_items WHERE id = ?', (item_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم حذف المادة من المخزن'})

# ----------------- UPLOAD DOCUMENTS & PHOTOS -----------------
@app.route('/api/customers/<id>/upload', methods=['POST'])
def upload_document(id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    if 'file' not in request.files:
        return jsonify({'error': 'الملف غير موجود في الطلب'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'لم يتم اختيار ملف'}), 400
        
    filename = secure_filename(file.filename)
    # Give a unique filename based on customer and time
    import time
    unique_filename = f"{id}_{int(time.time())}_{filename}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    
    file.save(file_path)
    
    # Store path in database
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        import filetype
        
        file_bytes = file.read(2048)
        file.seek(0)
        kind = filetype.guess(file_bytes)
        
        if kind is None:
            return jsonify({'error': 'نوع الملف غير معروف'}), 400
            
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'pdf'}
        if kind.extension not in allowed_extensions:
            return jsonify({'error': 'نوع الملف غير مسموح به'}), 400
            
        file_ext = '.' + kind.extension
        if file_ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
            file_type = 'صورة'
        elif file_ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp']:
            file_type = 'فيديو'
        else:
            file_type = 'ملف PDF'
        
        cursor.execute('''
            INSERT INTO documents (customer_id, file_name, file_type, file_path)
            VALUES (?, ?, ?, ?)
        ''', (id, filename, file_type, unique_filename))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم رفع وحفظ المستند بنجاح'})

@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    doc = query_db('SELECT * FROM documents WHERE id = ?', (doc_id,), one=True)
    if not doc:
        return jsonify({'error': 'المستند غير موجود'}), 404
        
    # Delete from folder
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], doc['file_path'])
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
            
    # Delete from DB
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM documents WHERE id = ?', (doc_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم حذف المستند بنجاح'})

# ----------------- DYNAMIC SETTINGS & LISTS API -----------------
@app.route('/api/settings', methods=['GET'])
def get_settings():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    rows = query_db('SELECT * FROM settings')
    return jsonify({r['key']: r['value'] for r in rows})

@app.route('/api/settings', methods=['POST'])
def save_settings():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        from werkzeug.security import generate_password_hash
        for k, v in data.items():
            if k == 'admin_password':
                v = generate_password_hash(str(v))
            cursor.execute('''
                INSERT INTO settings (key, value)

                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            ''', (k, str(v)))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم حفظ الإعدادات بنجاح'})

@app.route('/api/settings/logo', methods=['POST'])
def upload_logo():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    if 'file' not in request.files:
        return jsonify({'error': 'الملف غير موجود في الطلب'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'لم يتم اختيار ملف'}), 400
        
    filename = secure_filename(file.filename)
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
        return jsonify({'error': 'صيغة الملف غير مدعومة، يرجى اختيار صورة'}), 400
        
    import time
    unique_filename = f"logo_{int(time.time())}{file_ext}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    
    file.save(file_path)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ''', ('company_logo', unique_filename))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم رفع وتعديل الشعار بنجاح', 'logo_path': unique_filename})

@app.route('/api/settings/upload-print-image/<type_name>', methods=['POST'])
def upload_print_image(type_name):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    valid_types = [
        'contract_header', 'contract_footer',
        'warranty_header', 'warranty_footer',
        'handover_header', 'handover_footer',
        'receipt_header', 'receipt_footer'
    ]
    if type_name not in valid_types:
        return jsonify({'error': 'نوع غير صالح'}), 400
        
    if 'file' not in request.files:
        return jsonify({'error': 'الملف غير موجود في الطلب'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'لم يتم اختيار ملف'}), 400
        
    filename = secure_filename(file.filename)
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
        return jsonify({'error': 'صيغة الملف غير مدعومة، يرجى اختيار صورة'}), 400
        
    import time
    unique_filename = f"print_{type_name}_{int(time.time())}{file_ext}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    
    file.save(file_path)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        db_key = f'print_{type_name}_img'
        cursor.execute('''
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ''', (db_key, unique_filename))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({
        'success': True, 
        'message': 'تم رفع الصورة وتحديث إعدادات الطباعة بنجاح', 
        'image_path': unique_filename
    })

@app.route('/api/settings/lists', methods=['GET'])
def get_settings_lists():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    rows = query_db('SELECT * FROM dynamic_lists ORDER BY list_name, item_value ASC')
    lists = {}
    for r in rows:
        name = r['list_name']
        if name not in lists:
            lists[name] = []
        lists[name].append({'id': r['id'], 'value': r['item_value']})
    return jsonify(lists)

@app.route('/api/settings/lists', methods=['POST'])
def add_list_item():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    list_name = data.get('list_name')
    item_value = data.get('item_value')
    
    if not list_name or not item_value:
        return jsonify({'error': 'جميع الحقول مطلوبة'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO dynamic_lists (list_name, item_value) VALUES (?, ?)', (list_name, item_value))
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'هذه القيمة موجودة بالفعل'}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تمت إضافة القيمة الجديدة'})

@app.route('/api/settings/lists/<int:item_id>', methods=['DELETE'])
def delete_list_item(item_id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM dynamic_lists WHERE id = ?', (item_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'تم حذف العنصر بنجاح'})

# ----------------- DASHBOARD ANALYTICS API -----------------
@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    # 1. Total Sales (Installment Contract prices + Cash Customer Contract prices)
    sales = query_db('SELECT SUM(total_price) as sum FROM financial_status', one=True)
    total_sales = sales['sum'] if sales['sum'] else 0.0
    
    # 2. Total Paid (All down payments + paid installments)
    down_payments = query_db('SELECT SUM(down_payment) as sum FROM financial_status', one=True)
    total_down_payments = down_payments['sum'] if down_payments['sum'] else 0.0
    
    paid_installments = query_db("SELECT SUM(amount) as sum FROM installments WHERE status = 'Paid'", one=True)
    total_paid_installments = paid_installments['sum'] if paid_installments['sum'] else 0.0
    
    total_collections = total_down_payments + total_paid_installments
    
    # 3. Customer Debts (Total sales - collections)
    total_debts = max(0.0, total_sales - total_collections)
    
    # 4. Total Expenses (General Expenses)
    expenses = query_db('SELECT SUM(amount) as sum FROM company_expenses', one=True)
    general_expenses = expenses['sum'] if expenses['sum'] else 0.0
    
    # 5. Total Cost of Goods Sold (Sold Parts Cost)
    cogs = query_db('SELECT SUM(cost_price * quantity) as sum FROM customer_components', one=True)
    total_cogs = cogs['sum'] if cogs['sum'] else 0.0
    
    # Combined Expenses
    total_expenses = general_expenses + total_cogs
    
    # 6. Profits
    net_profit = total_collections - total_expenses  # Real Cash Flow profit
    net_profit_accounting = total_sales - total_expenses  # Book/Accounting profit
    
    # 6. Unpaid/Overdue installments (Filtered to current month only)
    import datetime
    current_month_prefix = datetime.date.today().strftime('%Y-%m') + '%'
    unpaid_list = query_db('''
        SELECT i.*, c.name as customer_name, c.phone as customer_phone
        FROM installments i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'Unpaid' AND i.due_date LIKE ?
        ORDER BY i.due_date ASC
        LIMIT 20
    ''', (current_month_prefix,))
    
    # Check for overdue installments in database and update their status to Overdue if due_date is in the past
    import datetime
    today_str = datetime.date.today().strftime('%Y-%m-%d')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE installments SET status = 'Overdue' WHERE status = 'Unpaid' AND due_date < ?", (today_str,))
    conn.commit()
    conn.close()
    
    overdue_list = query_db('''
        SELECT i.*, c.name as customer_name, c.phone as customer_phone
        FROM installments i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'Overdue'
        ORDER BY i.due_date ASC
    ''')
    
    # 7. Chart Data (Monthly Sales vs Expenses)
    # Build chart data by compiling lists of sums per month
    chart_sales_rows = query_db('''
        SELECT strftime('%Y-%m', installation_date) as month, SUM(f.total_price) as total
        FROM customers c
        JOIN financial_status f ON c.id = f.customer_id
        GROUP BY month
        ORDER BY month ASC
        LIMIT 12
    ''')
    
    chart_expenses_rows = query_db('''
        SELECT strftime('%Y-%m', expense_date) as month, SUM(amount) as total
        FROM company_expenses
        GROUP BY month
        ORDER BY month ASC
        LIMIT 12
    ''')
    
    return jsonify({
        'total_sales': total_sales,
        'total_collections': total_collections,
        'total_debts': total_debts,
        'total_expenses': total_expenses,
        'total_cogs': total_cogs,
        'net_profit': net_profit,
        'net_profit_accounting': net_profit_accounting,
        'upcoming_installments': [dict(i) for i in unpaid_list],
        'overdue_installments': [dict(i) for i in overdue_list],
        'chart_sales': [dict(r) for r in chart_sales_rows],
        'chart_expenses': [dict(r) for r in chart_expenses_rows]
    })

# ----------------- ARABIC CONTRACT/WARRANTY TEXT COMPILER -----------------
@app.route('/api/customers/<id>/compile-docs', methods=['GET'])
def compile_documents(id):
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    cust = query_db('SELECT * FROM customers WHERE id = ?', (id,), one=True)
    if not cust:
        return jsonify({'error': 'العميل غير موجود'}), 404
        
    c = dict(cust)
    
    # Get settings
    sets_rows = query_db('SELECT * FROM settings')
    settings = {r['key']: r['value'] for r in sets_rows}
    
    # Financial details
    fin = query_db('SELECT * FROM financial_status WHERE customer_id = ?', (id,), one=True)
    f = dict(fin) if fin else {'total_price': 0, 'down_payment': 0, 'remaining_balance': 0, 'total_installments': 0}
    
    # Components details for warranty
    comps = query_db('SELECT * FROM customer_components WHERE customer_id = ?', (id,))
    comp_list_text = ""
    visible_idx = 1
    for comp in comps:
        if comp['component_type'] != 'Secondary':
            comp_list_text += f"{visible_idx}. {comp['component_name']} - عدد: {comp['quantity']} - ضمان: {comp['warranty_period']}\n"
            visible_idx += 1
        
    if not comp_list_text:
        comp_list_text = "لا توجد أجهزة رئيسية مسجلة للضمان بعد."
        
    # Fetch first installment amount
    first_inst = query_db('SELECT amount FROM installments WHERE customer_id = ? ORDER BY installment_number ASC LIMIT 1', (id,), one=True)
    inst_val = first_inst['amount'] if first_inst else 0.0
    
    # Variables for replacement
    vars_map = {
        '{تاريخ_التنصيب}': c.get('installation_date', ''),
        '{اسم_الشركة}': settings.get('company_name', 'هايبرد إينرجي للطاقة الشمسية'),
        '{اسم_العميل}': c.get('name', ''),
        '{هاتف_العميل}': c.get('phone', ''),
        '{عنوان_العميل}': c.get('address', ''),
        '{رقم_العميل}': c.get('id', ''),
        '{المبلغ_الإجمالي}': f"{f['total_price']:,.2f}",
        '{الدفعة_الأولى}': f"{f['down_payment']:,.2f}",
        '{المبلغ_المتبقي}': f"{f['remaining_balance']:,.2f}",
        '{عدد_الأقساط}': str(f['total_installments']),
        '{قيمة_القسط}': f"{inst_val:,.2f}",
        '{تفاصيل_ضمان_القطع}': comp_list_text
    }
    
    # Compile
    contract_raw = settings.get('contract_template', '')
    warranty_raw = settings.get('warranty_template', '')
    
    for k, v in vars_map.items():
        contract_raw = contract_raw.replace(k, str(v))
        warranty_raw = warranty_raw.replace(k, str(v))
        
    return jsonify({
        'customer_id': id,
        'customer_name': c['name'],
        'customer_phone': c['phone'],
        'sale_type': c['sale_type'],
        'compiled_contract': contract_raw,
        'compiled_warranty': warranty_raw,
        'print_header_template': settings.get('print_header_template', ''),
        'print_footer_template': settings.get('print_footer_template', ''),
        'components': [dict(cp) for cp in comps],
        'financials': f,
        'company_info': {
            'name': settings.get('company_name', 'هايبرد إينرجي'),
            'phone': settings.get('company_phone', ''),
            'address': settings.get('company_address', ''),
            'logo': settings.get('company_logo', ''),
            'print_contract_header_img': settings.get('print_contract_header_img', ''),
            'print_contract_footer_img': settings.get('print_contract_footer_img', ''),
            'print_warranty_header_img': settings.get('print_warranty_header_img', ''),
            'print_warranty_footer_img': settings.get('print_warranty_footer_img', ''),
            'print_handover_header_img': settings.get('print_handover_header_img', ''),
            'print_handover_footer_img': settings.get('print_handover_footer_img', ''),
            'print_receipt_header_img': settings.get('print_receipt_header_img', ''),
            'print_receipt_footer_img': settings.get('print_receipt_footer_img', '')
        }
    })

# ----------------- CLOUDFLARE R2 BACKUP ROUTES -----------------
@app.route('/api/settings/r2-status', methods=['GET'])
def get_r2_status():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = get_db_connection()
    r2_enabled_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_backup_enabled'").fetchone()
    r2_last_backup_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_last_backup_time'").fetchone()
    r2_account_id_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_account_id'").fetchone()
    r2_access_key_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_access_key_id'").fetchone()
    r2_secret_key_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_secret_access_key'").fetchone()
    r2_bucket_name_row = conn.execute("SELECT value FROM settings WHERE key = 'r2_bucket_name'").fetchone()
    conn.close()
    
    enabled = (r2_enabled_row['value'] == 'true') if r2_enabled_row else False
    last_backup = r2_last_backup_row['value'] if r2_last_backup_row else 'لم يتم الرفع مسبقاً'
    account_id = r2_account_id_row['value'] if r2_account_id_row else ''
    access_key_id = r2_access_key_row['value'] if r2_access_key_row else ''
    secret_access_key = r2_secret_key_row['value'] if r2_secret_key_row else ''
    bucket_name = r2_bucket_name_row['value'] if r2_bucket_name_row else ''
    
    # Mask secret key for UI display
    masked_secret = ""
    if secret_access_key:
        masked_secret = secret_access_key[:4] + "*" * 24 + secret_access_key[-4:]
        
    return jsonify({
        'enabled': enabled,
        'last_backup': last_backup,
        'account_id': account_id,
        'access_key_id': access_key_id,
        'secret_access_key': masked_secret,
        'bucket_name': bucket_name
    })

@app.route('/api/settings/r2-save', methods=['POST'])
def save_r2_settings():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json or {}
    account_id = data.get('account_id', '').strip()
    access_key_id = data.get('access_key_id', '').strip()
    secret_access_key = data.get('secret_access_key', '').strip()
    bucket_name = data.get('bucket_name', '').strip()
    enabled = data.get('enabled', False)
    
    conn = get_db_connection()
    # If secret key is all masked (contains '*'), do not overwrite the existing key
    if secret_access_key and '*' in secret_access_key:
        existing = conn.execute("SELECT value FROM settings WHERE key = 'r2_secret_access_key'").fetchone()
        secret_access_key = existing['value'] if existing else ''
        
    val_str = 'true' if enabled else 'false'
    
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('r2_account_id', ?)", (account_id,))
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('r2_access_key_id', ?)", (access_key_id,))
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('r2_secret_access_key', ?)", (secret_access_key,))
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('r2_bucket_name', ?)", (bucket_name,))
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('r2_backup_enabled', ?)", (val_str,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'تم حفظ إعدادات النسخ الاحتياطي بنجاح'})

@app.route('/api/settings/r2-backup', methods=['POST'])
def manual_r2_backup():
    if not is_authenticated():
        return jsonify({'error': 'Unauthorized'}), 401
        
    res = upload_backup_to_r2()
    if res:
        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        conn = get_db_connection()
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('r2_last_backup_time', ?)", (now_str,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم رفع النسخة الاحتياطية بنجاح إلى Cloudflare R2', 'time': now_str})
    else:
        return jsonify({'success': False, 'message': 'فشل رفع النسخة الاحتياطية. يرجى مراجعة بيانات الاعتماد'}), 500


if __name__ == '__main__':
    # Start background backup scheduler if enabled in a daemon thread
    try:
        scheduler = BackupScheduler()
        scheduler.start()
        print("BackupScheduler thread (Cloudflare R2) started successfully.")
    except Exception as e:
        print(f"Error starting BackupScheduler: {e}")
        
    app.run(host='0.0.0.0', port=5000, debug=True)
