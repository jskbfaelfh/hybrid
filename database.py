import sqlite3
import os

DB_PATH = 'solar_db.db'

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
            notes TEXT
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
        'company_name': 'شمس-تك للطاقة الشمسية',
        'company_phone': '07700000000',
        'company_address': 'العراق، بغداد',
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
        
    conn.commit()
    conn.close()
    print("Database initialized successfully.")

if __name__ == '__main__':
    init_db()
