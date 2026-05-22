import sqlite3
import os

# Store DB inside backend folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'solar_db.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Customers Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT,
            installation_date TEXT,
            sale_type TEXT CHECK(sale_type IN ('Cash', 'Installment')),
            notes TEXT,
            system_status TEXT DEFAULT 'قيد التنفيذ',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 2. Financial Status Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS financial_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT UNIQUE,
            total_price REAL NOT NULL,
            down_payment REAL NOT NULL,
            remaining_balance REAL NOT NULL,
            total_installments INTEGER NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        )
    ''')
    
    # 3. Installments Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS installments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT,
            installment_number INTEGER NOT NULL,
            amount REAL NOT NULL,
            due_date TEXT NOT NULL,
            status TEXT CHECK(status IN ('Paid', 'Unpaid', 'Overdue')) DEFAULT 'Unpaid',
            paid_date TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        )
    ''')
    
    # 4. Customer Components Table (Solar System Details)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customer_components (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT,
            component_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            total_price REAL NOT NULL,
            warranty_period TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        )
    ''')
    
    # 5. Inventory Items Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT NOT NULL UNIQUE,
            item_category TEXT NOT NULL,
            quantity_on_hand INTEGER DEFAULT 0,
            min_threshold INTEGER DEFAULT 5,
            cost_price REAL DEFAULT 0.0,
            notes TEXT
        )
    ''')
    
    # 5.5. Inventory Transactions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            transaction_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            related_customer TEXT,
            notes TEXT,
            FOREIGN KEY(item_id) REFERENCES inventory_items(id)
        )
    ''')
    
    # 6. Company Expenses Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS company_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            expense_date TEXT NOT NULL,
            notes TEXT
        )
    ''')
    
    # 7. Documents and Photos Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        )
    ''')
    
    # 8. Dynamic Lists Table (for settings dropdowns)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dynamic_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            list_name TEXT NOT NULL,
            item_value TEXT NOT NULL UNIQUE
        )
    ''')
    
    # 9. General Settings Table (Admin password, Contract & Warranty templates)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    
    # Seed default dynamic lists
    default_lists = [
        ('panel_brands', 'Trina Solar (تريناتك)'),
        ('panel_brands', 'Jinko Solar (جينكو)'),
        ('panel_brands', 'Longi Solar (لونجي)'),
        ('inverter_brands', 'Growatt (غرووات)'),
        ('inverter_brands', 'Deye (ديه)'),
        ('inverter_brands', 'Voltronic (فولترونيك)'),
        ('battery_types', 'Lithium Deye 100Ah (ليثيوم)'),
        ('battery_types', 'Lithium Felicity 200Ah (ليثيوم)'),
        ('battery_types', 'Gel Narada 12V 200Ah (جيل)'),
        ('expense_categories', 'شراء مواد وأنظمة شمسية'),
        ('expense_categories', 'أجور فنيين وعمال تركيب'),
        ('expense_categories', 'أجور نقل وشحن ولوجستيات'),
        ('expense_categories', 'إعلانات وتسويق'),
        ('expense_categories', 'مصاريف إدارية وإيجار مكتب')
    ]
    
    for list_name, item_value in default_lists:
        try:
            cursor.execute('INSERT OR IGNORE INTO dynamic_lists (list_name, item_value) VALUES (?, ?)', (list_name, item_value))
        except sqlite3.Error:
            pass
            
    # Seed default settings
    default_settings = {
        'admin_password': 'admin',
        'company_name': 'هايبرد إينرجي للطاقة الشمسية',
        'company_phone': '07700000000',
        'company_address': 'العراق، بغداد',
        'engineer_name': 'أحمد علي',
        'print_header_template': '''<div class="print-custom-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0B2545; padding-bottom: 15px; margin-bottom: 20px; direction: rtl; font-family: 'Cairo', sans-serif;">
    <div style="display: flex; align-items: center; gap: 15px;">
        <div class="print-logo-container" style="display: flex; align-items: center;">
            {شعار_الشركة}
        </div>
        <div style="display: flex; flex-direction: column;">
            <span style="font-size: 18pt; font-weight: 800; color: #0B2545; line-height: 1.2;">{اسم_الشركة}</span>
            <span style="font-size: 9pt; color: #555; font-weight: bold;">أنظمة طاقة شمسية هجينة وذكية</span>
        </div>
    </div>
    <div style="text-align: left; font-size: 9.5pt; color: #333; line-height: 1.6;">
        <div style="font-weight: bold; color: #0B2545; font-size: 11pt; margin-bottom: 4px;">قسم المبيعات والتسليم</div>
        <strong>الهاتف:</strong> {هاتف_الشركة}<br>
        <strong>العنوان:</strong> {عنوان_الشركة}
    </div>
</div>''',
        'print_footer_template': '''<div class="print-custom-footer" style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 40px; direction: rtl; font-family: 'Cairo', sans-serif; font-size: 8.5pt; color: #666; display: flex; justify-content: space-between; align-items: center; width: 100%;">
    <div>وثيقة رسمية صادرة من شركة {اسم_الشركة} للطاقة المستدامة ☀️</div>
    <div style="text-align: left;">
        تاريخ الطباعة: {تاريخ_اليوم} | هاتف: {هاتف_الشركة}
    </div>
</div>''',
        'contract_template': '''عقد اتفاق وتوريد نظام طاقة شمسية

إنه في تاريخ {تاريخ_التنصيب}، تم الاتفاق بين شركة {اسم_الشركة} ويمثلها المدير المسؤول، وبين العميل المحترم {اسم_العميل}، حامل رقم الهاتف {هاتف_العميل}، والعنوان {عنوان_العميل}.

بنود العقد:
1. يلتزم الطرف الأول (الشركة) بتجهيز وتركيب نظام طاقة شمسية متكامل للطرف الثاني (العميل) بقيمة إجمالية قدرها {المبلغ_الإجمالي} دينار/دولار عراقي.
2. قام الطرف الثاني بدفع مقدمة مالية (دفعة أولى) قدرها {الدفعة_الأولى}، ويتبقى في ذمته مبلغ وقدره {المبلغ_المتبقي} يتم سداده على شكل أقساط شهرية متتالية عددها {عدد_الأقساط} أشهر، وقيمة القسط الشهري هي {قيمة_القسط} تدفع في تاريخ الاستحقاق المتفق عليه.
3. يلتزم الطرف الأول بضمان جودة الأجهزة والتركيب حسب وثيقة الضمان المستقلة المرفقة بهذا العقد.
4. يقر الطرف الثاني بمعاينة وتجربة النظام بعد التركيب وقبوله بالحالة المتفق عليها.

توقيع الطرف الأول (الشركة):                           توقيع الطرف الثاني (العميل):''',
        'warranty_template': '''وثيقة ضمان وجودة نظام طاقة شمسية

تتشرف شركة {اسم_الشركة} بتقديم شهادة الضمان هذه للعميل المحترم {اسم_العميل} لتركيب نظام الطاقة الشمسية ذو الرقم التعريفي {رقم_العميل}.

شروط وضوابط الضمان:
1. يشمل الضمان كافة القطع المنصبة والمذكورة في تقرير التسليم ضد أي عيوب مصنعية خلال فترات الضمان المحددة لكل قطعة.
2. لا يشمل الضمان الأضرار الناتجة عن سوء الاستخدام، العبث بالأجهزة من فنيين غير معتمدين من شركتنا، أو الكوارث الطبيعية والصواعق.
3. تلتزم الشركة بإجراء زيارات فحص وصيانة طارئة خلال فترة الضمان عند حدوث أي خلل مصنعي.

تفاصيل ضمان القطع المجهزة:
{تفاصيل_ضمان_القطع}

شركة {اسم_الشركة} تتمنى لكم طاقة مستدامة وآمنة.'''
    }
    
    for key, value in default_settings.items():
        cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', (key, value))
        
    # Seed user Cloudflare R2 credentials
    r2_credentials = {
        'r2_account_id': 'b744e5bfffde3186c345647531fa6ff7',
        'r2_access_key_id': 'e94ce0e38378aa2cd6cbc0929046e2d2',
        'r2_secret_access_key': 'ada9a7384fbc1dd250ea3162d0f51ceead63691369b99490d5452f126945c15a',
        'r2_bucket_name': 'solar-backups',
        'r2_backup_enabled': 'true'
    }
    for key, value in r2_credentials.items():
        cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, value))
        
    # 10. Dynamic Migrations (Add new columns dynamically if they do not exist)
    migrations = [
        ("customer_components", "cost_price", "REAL NOT NULL DEFAULT 0"),
        ("customer_components", "component_type", "TEXT CHECK(component_type IN ('Primary', 'Secondary')) DEFAULT 'Primary'"),
        ("customer_components", "sourcing_type", "TEXT CHECK(sourcing_type IN ('Stock', 'Direct')) DEFAULT 'Stock'"),
        ("company_expenses", "customer_id", "TEXT REFERENCES customers (id) ON DELETE SET NULL"),
        ("customers", "installation_method", "TEXT"),
        ("customers", "gps_link", "TEXT")
    ]
    
    for table, column, col_type in migrations:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        except sqlite3.OperationalError:
            # Column already exists, fail silently
            pass
            
    conn.commit()
    conn.close()
    print("Database initialized successfully with Cloudflare R2 credentials and dynamic migrations.")

if __name__ == '__main__':
    init_db()
