/* 
   ==========================================================================
   شمس-تك للطاقة الشمسية | وحدة التحكم والتفاعل البرمجي للواجهات (app.js)
   ==========================================================================
*/

// Support Android Native Printing Bridge
if (typeof window !== 'undefined' && window.AndroidBridge && window.AndroidBridge.triggerPrint) {
    window.print = function() {
        window.AndroidBridge.triggerPrint();
    };
}

// Global variables and state
let activeTab = 'dashboard';
let currentCustomerId = null;
let currentFinancialsCustomerId = null; // Store customer ID for active financial modal
let selectedBulkCustomers = new Set();
let dashboardChartInstance = null;
let currentCompanyName = 'هايبرد إينرجي';
let currentEngineerName = 'أحمد علي';
let allCustomers = [];
let currentCustomerData = null;

// On document load
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

// Initialize the application
function initApp() {
    setupNavigation();
    setupProfileTabs();
    setupSettingsTabs();
    loadDashboardStats();
    setupLogout();
    loadSettings(); // Load custom settings & logo on startup!
    initNotifications(); // Setup Browser Web Notifications System!
    
    // Refresh dashboard data occasionally
    setInterval(loadDashboardStats, 60000);
}

// ----------------- SIDEBAR ROUTING & NAVIGATION -----------------
function setupNavigation() {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Close sidebar on mobile
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
            
            // Remove active classes
            menuItems.forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            // Set active
            this.classList.add('active');
            const targetPane = document.getElementById(`pane-${targetTab}`);
            if (targetPane) targetPane.classList.add('active');
            
            activeTab = targetTab;
            updateViewHeader();
            
            // Load respective data
            if (activeTab === 'dashboard') {
                loadDashboardStats();
            } else if (activeTab === 'customers') {
                loadCustomers();
            } else if (activeTab === 'systems') {
                loadSystems();
            } else if (activeTab === 'alerts') {
                loadBulkCustomersList();
            } else if (activeTab === 'inventory') {
                loadInventory();
            } else if (activeTab === 'expenses') {
                loadExpenses();
            } else if (activeTab === 'settings') {
                loadSettings();
            }
        });
    });
}

function updateViewHeader() {
    const title = document.getElementById('viewTitle');
    const subtitle = document.getElementById('viewSubtitle');
    
    const headers = {
        dashboard: {
            t: 'لوحة التحكم الإحصائية',
            s: `أهلاً بك مهندس ${currentEngineerName}. إليك نظرة شاملة على أعمال ${currentCompanyName} اليوم.`
        },
        customers: {
            t: 'العملاء',
            s: 'تسجيل العملاء، مراجعة أنظمة الطاقة الخاصة بهم، متابعة الأقساط وطباعة العقود والضمانات.'
        },
        systems: {
            t: 'المنظومات',
            s: 'نظرة شاملة وسريعة للمنظومات المنصبة مع متابعة حالتها والمصاريف الخاصة بكل منظومة.'
        },
        alerts: {
            t: 'مركز التنبيهات المجمعة والواتساب',
            s: 'إرسال إشعارات جماعية لكافة العملاء بضغطة زر مع إمكانية استثناء عملاء محددين.'
        },
        inventory: {
            t: 'مستودع ومخزن القطع',
            s: 'إدارة وتتبع المواد المتوفرة لديك من ألواح وبطاريات وعواكس لتجهيز العملاء.'
        },
        expenses: {
            t: 'المصاريف التشغيلية والأجور',
            s: 'تسجيل ومتابعة كافة المبالغ المصروفة في الشركة لشراء المواد وأجور التركيب والصيانة.'
        },
        settings: {
            t: 'إعدادات النظام الديناميكية',
            s: 'تعديل بيانات الشركة، تغيير كلمة المرور، تعديل قوالب العقود والضمانات، وإدارة القوائم.'
        }
    };
    
    if (headers[activeTab]) {
        title.innerText = headers[activeTab].t;
        subtitle.innerText = headers[activeTab].s;
    }
}

// ----------------- PROFILE INTERNAL TABS -----------------
function setupProfileTabs() {
    const tabBtns = document.querySelectorAll('#pane-customer-profile .tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-profile-tab');
            
            // Remove active classes & hide all panes
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#pane-customer-profile .profile-tab-pane').forEach(p => {
                p.classList.remove('active');
                p.style.display = 'none';
            });
            
            // Set active & show target
            this.classList.add('active');
            const targetPane = document.getElementById(`profile-tab-${targetTab}`);
            if (targetPane) {
                targetPane.classList.add('active');
                targetPane.style.display = 'block';
            }
        });
    });
}

// ----------------- SETTINGS INTERNAL TABS -----------------
function setupSettingsTabs() {
    const tabBtns = document.querySelectorAll('[data-settings-tab]');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-settings-tab');
            
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-tab-pane').forEach(p => {
                p.style.display = 'none';
            });
            
            // Set active
            this.classList.add('active');
            const targetPane = document.getElementById(`settings-tab-${targetTab}`);
            if (targetPane) {
                targetPane.style.display = 'block';
            }
            
            if (targetTab === 'backup') {
                loadR2BackupStatus();
            }
        });
    });
}

// ----------------- CURRENCY LOCAL FORMATTER -----------------
function formatCurrency(value) {
    return new Intl.NumberFormat('ar-IQ', { style: 'decimal', maximumFractionDigits: 0 }).format(value) + ' د.ع';
}

// ----------------- DASHBOARD METRICS & CHARTS -----------------
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/dashboard/stats');
        if (!res.ok) return;
        const stats = await res.json();
        
        // Populate stats
        document.getElementById('stat-sales').innerText = formatCurrency(stats.total_sales);
        document.getElementById('stat-collections').innerText = formatCurrency(stats.total_collections);
        document.getElementById('stat-debts').innerText = formatCurrency(stats.total_debts);
        document.getElementById('stat-expenses').innerText = formatCurrency(stats.total_expenses);
        document.getElementById('stat-profit').innerText = formatCurrency(stats.net_profit);
        document.getElementById('stat-profit-accounting').innerText = formatCurrency(stats.net_profit_accounting);
        
        // Style Net Profit Cash Trend
        const profitDesc = document.getElementById('stat-profit-desc');
        if (stats.net_profit >= 0) {
            document.getElementById('stat-profit').style.color = 'var(--success)';
            profitDesc.innerText = 'صافي أرباح نقدية متوفرة في الشركة';
            profitDesc.style.color = 'var(--success)';
        } else {
            document.getElementById('stat-profit').style.color = '#f87171';
            profitDesc.innerText = 'خسارة مؤقتة (المصاريف أكبر من المقبوضات)';
            profitDesc.style.color = '#f87171';
        }

        // Style Net Profit Accounting Trend
        const profitAcctDesc = document.getElementById('stat-profit-accounting-desc');
        if (stats.net_profit_accounting >= 0) {
            document.getElementById('stat-profit-accounting').style.color = 'var(--neon-blue)';
            profitAcctDesc.innerText = 'أرباح المشاريع الدفترية المحققة';
            profitAcctDesc.style.color = 'var(--neon-blue)';
        } else {
            document.getElementById('stat-profit-accounting').style.color = '#f87171';
            profitAcctDesc.innerText = 'عجز دفتري كلي لمشروعات التوريد';
            profitAcctDesc.style.color = '#f87171';
        }
        
        // Render Overdue Alerts
        const overdueContainer = document.getElementById('dashboard-overdue-list');
        overdueContainer.innerHTML = '';
        
        if (stats.overdue_installments.length === 0) {
            overdueContainer.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 25px;">لا توجد أقساط متأخرة حالياً 👍</p>`;
        } else {
            stats.overdue_installments.forEach(inst => {
                const dueText = `قسط #${inst.installment_number} - متأخر منذ تاريخ: ${inst.due_date}`;
                const waLink = generateWhatsAppReminderLink(inst.customer_name, inst.customer_phone, inst.amount, inst.due_date, inst.installment_number);
                
                const card = document.createElement('div');
                card.style.cssText = `
                    background: rgba(239, 68, 68, 0.08); 
                    border: 1px solid rgba(239, 68, 68, 0.2); 
                    border-radius: 12px; 
                    padding: 12px; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    gap: 10px;
                `;
                
                card.innerHTML = `
                    <div>
                        <h4 style="font-size: 0.85rem; font-weight: bold; color: #fff; margin-bottom: 3px;">${inst.customer_name}</h4>
                        <p style="font-size: 0.75rem; color: #f87171; font-weight: 500;">${dueText}</p>
                        <p style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold; margin-top: 3px;">المبلغ: ${formatCurrency(inst.amount)}</p>
                    </div>
                        <button class="btn btn-primary" onclick="openStandaloneFinancialsModal(event, '${inst.customer_id}')" style="padding: 6px 10px; font-size: 0.75rem;">💰 تسديد وسجل</button>
                        <a href="${waLink}" target="_blank" class="btn btn-success" style="padding: 6px 10px; font-size: 0.75rem; background: #25d366; border:none; color:#fff; display: inline-flex; align-items: center; justify-content: center;"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></a>
                        <button class="btn btn-secondary" onclick="viewCustomerProfile('${inst.customer_id}', 'financial')" style="padding: 6px 10px; font-size: 0.75rem;">👤 ملفه</button>
                    </div>
                `;
                overdueContainer.appendChild(card);
            });
        }
        
        // Render Upcoming Alerts
        const upcomingContainer = document.getElementById('dashboard-upcoming-list');
        upcomingContainer.innerHTML = '';
        
        if (stats.upcoming_installments.length === 0) {
            upcomingContainer.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 25px;">لا توجد أقساط مستحقة قريباً 👍</p>`;
        } else {
            stats.upcoming_installments.forEach(inst => {
                const dueText = `قسط #${inst.installment_number} - يستحق في تاريخ: ${inst.due_date}`;
                const waLink = generateWhatsAppReminderLink(inst.customer_name, inst.customer_phone, inst.amount, inst.due_date, inst.installment_number);
                
                const card = document.createElement('div');
                card.style.cssText = `
                    background: rgba(251, 191, 36, 0.08); 
                    border: 1px solid rgba(251, 191, 36, 0.2); 
                    border-radius: 12px; 
                    padding: 12px; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    gap: 10px;
                `;
                
                card.innerHTML = `
                    <div>
                        <h4 style="font-size: 0.85rem; font-weight: bold; color: #fff; margin-bottom: 3px;">${inst.customer_name}</h4>
                        <p style="font-size: 0.75rem; color: #fbbf24; font-weight: 500;">${dueText}</p>
                        <p style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold; margin-top: 3px;">المبلغ: ${formatCurrency(inst.amount)}</p>
                    </div>
                    <div style="display:flex; gap: 5px;">
                        <button class="btn btn-primary" onclick="openStandaloneFinancialsModal(event, '${inst.customer_id}')" style="padding: 6px 10px; font-size: 0.75rem;">💰 تسديد وسجل</button>
                        <a href="${waLink}" target="_blank" class="btn btn-success" style="padding: 6px 10px; font-size: 0.75rem; background: #25d366; border:none; color:#fff; display: inline-flex; align-items: center; justify-content: center;"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></a>
                        <button class="btn btn-secondary" onclick="viewCustomerProfile('${inst.customer_id}', 'financial')" style="padding: 6px 10px; font-size: 0.75rem;">👤 ملفه</button>
                    </div>
                `;
                upcomingContainer.appendChild(card);
            });
        }
        
        // Trigger automated web notifications if needed
        checkAndTriggerSystemNotifications(stats);
        
    } catch (err) {
        console.error("Error loading dashboard statistics", err);
    }
}

// WhatsApp Reminders link helper
function generateWhatsAppReminderLink(name, phone, amount, dueDate, instNum) {
    let cleanPhone = phone.trim().replace(/[\s\-\+]/g, '');
    // Ensure Iraqi country code if starts with 07
    if (cleanPhone.startsWith('07')) {
        cleanPhone = '964' + cleanPhone.substring(1);
    }
    
    const text = `السلام عليكم ورحمة الله وبركاته\nعزيزي العميل المحترم *${name}* ☀️\n\nنود تذكيرك بموعد القسط الشهري البالغ *${formatCurrency(amount)}* (القسط رقم *${instNum}*)، والمستحق بتاريخ *${dueDate}*.\n\nنتمنى لكم دوام الطاقة المستدامة والآمنة ⚡\nشركة ${currentCompanyName}.`;
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
}

// Chart.js Visual renderer (Removed by user request)
function renderDashboardChart(salesData, expensesData) {
    // تم حذف الرسم البياني بناءً على طلب العميل
}
// ----------------- CUSTOMERS PAGE -----------------
// Central 401 handler - if session expired redirect to login
function handle401(res) {
    if (res.status === 401) {
        window.location.href = '/';
        return true;
    }
    return false;
}

async function loadCustomers() {
    try {
        const res = await fetch('/api/customers');
        if (handle401(res)) return;
        if (!res.ok) return;
        const data = await res.json();
        allCustomers = data;
        renderCustomersTable(allCustomers);
        setupCustomerSearch();
    } catch (err) {
        console.error('Error loading customers', err);
    }
}

function renderCustomersTable(customers) {
    const grid = document.getElementById('customers-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (customers.length === 0) {
        grid.innerHTML = `<p style="text-align: center; padding: 25px; grid-column: 1 / -1; color: var(--text-muted);">لا يوجد عملاء مطابقين للبحث.</p>`;
        return;
    }
    
    customers.forEach(cust => {
        const price = cust.financials ? formatCurrency(cust.financials.total_price) : 'غير محدد';
        const saleTypeBadge = cust.sale_type === 'Installment' 
            ? '<span class="customer-card-tag installment">تقسيط 📅</span>' 
            : '<span class="customer-card-tag cash">نقد 💵</span>';
            
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.onclick = () => {
            viewCustomerProfile(cust.id, 'info');
        };
        
        card.innerHTML = `
            <div class="customer-card-content">
                <div class="customer-card-header">
                    <div>
                        <div class="customer-card-name">${cust.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">كود العميل: ${cust.id}</div>
                    </div>
                    ${saleTypeBadge}
                </div>
                <div class="customer-card-body">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>🏢</span>
                        <span>نوع التعاقد: ${cust.sale_type === 'Installment' ? 'أقساط شهرية متتالية' : 'بيع مباشر كاش'}</span>
                    </div>
                </div>
                <div class="customer-card-footer">
                    <div class="customer-card-price">${price}</div>
                    <button class="customer-card-btn-financial" onclick="openStandaloneFinancialsModal(event, '${cust.id}')">
                        <span>💳</span>
                        <span>المالية</span>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function setupCustomerSearch() {
    const input = document.getElementById('customerSearch');
    input.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        const filtered = allCustomers.filter(c => 
            c.name.toLowerCase().includes(query) || 
            c.phone.includes(query) || 
            c.id.toLowerCase().includes(query)
        );
        renderCustomersTable(filtered);
    });
}

// ----------------- SYSTEMS PAGE -----------------
let allSystems = [];

async function loadSystems() {
    try {
        const res = await fetch('/api/customers');
        if (handle401(res)) return;
        if (!res.ok) return;
        allSystems = await res.json();
        
        const query = (document.getElementById('systemSearch').value || '').toLowerCase().trim();
        const filtered = allSystems.filter(c => 
            c.name.toLowerCase().includes(query) || 
            c.phone.includes(query) || 
            c.id.toLowerCase().includes(query)
        );
        renderSystemsGrid(filtered);
    } catch (err) {
        console.error('Error loading systems', err);
    }
}

function renderSystemsGrid(systems) {
    const grid = document.getElementById('systems-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (systems.length === 0) {
        grid.innerHTML = `<p style="text-align: center; padding: 25px; grid-column: 1 / -1; color: var(--text-muted);">لا يوجد منظومات مطابقة.</p>`;
        return;
    }
    
    systems.forEach(sys => {
        const isCompleted = sys.system_status === 'مكتمل';
        const statusBadge = isCompleted 
            ? '<span class="customer-card-tag cash" style="background: var(--success-glow); border-color: var(--success-glow);">مكتملة ✅</span>' 
            : '<span class="customer-card-tag installment" style="background: var(--warning-glow); border-color: var(--warning-glow);">قيد التنفيذ ⏳</span>';
            
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.onclick = () => {
            openSystemDetailsModal(sys.id);
        };
        
        card.innerHTML = `
            <div class="customer-card-content">
                <div class="customer-card-header">
                    <div>
                        <div class="customer-card-name">${sys.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">تاريخ: ${sys.installation_date || 'غير محدد'}</div>
                    </div>
                    ${statusBadge}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function openSystemDetailsModal(id) {
    document.getElementById('sys-modal-cust-id').value = id;
    openModal('modalSystemDetails');
    
    document.getElementById('system-modal-title').innerHTML = `🛠️ تفاصيل المنظومة: جاري التحميل...`;
    
    try {
        const res = await fetch(`/api/customers/${id}`);
        if (!res.ok) return;
        const cust = await res.json();
        
        currentCustomerData = cust; // Share state
        
        document.getElementById('system-modal-title').innerHTML = `🛠️ تفاصيل المنظومة (${cust.id})`;
        document.getElementById('sys-modal-name').innerText = cust.name;
        document.getElementById('sys-modal-phone').innerText = cust.phone;
        document.getElementById('sys-modal-date').innerText = 'تاريخ التنصيب: ' + (cust.installation_date || 'غير محدد');
        
        // Buttons
        document.getElementById('sys-modal-call-btn').href = `tel:${cust.phone}`;
        let cleanPhone = cust.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('07')) cleanPhone = '964' + cleanPhone.substring(1);
        document.getElementById('sys-modal-wa-btn').href = `https://api.whatsapp.com/send?phone=${cleanPhone}`;
        
        if (cust.gps_link) {
            const gpsBtn = document.getElementById('sys-modal-gps-btn');
            gpsBtn.href = cust.gps_link;
            gpsBtn.style.display = 'inline-block';
        } else {
            document.getElementById('sys-modal-gps-btn').style.display = 'none';
        }
        
        // Status button
        const isCompleted = cust.system_status === 'مكتمل';
        const statusBtn = document.getElementById('sys-modal-status-btn');
        if (isCompleted) {
            statusBtn.innerText = 'إلغاء الاكتمال ⏳';
            statusBtn.className = 'btn btn-secondary';
            statusBtn.style.background = '';
        } else {
            statusBtn.innerText = 'تحديد كمكتملة ✅';
            statusBtn.className = 'btn btn-primary';
            statusBtn.style.background = 'var(--success-glow)';
        }
        
        // Components
        const compTbody = document.getElementById('sys-modal-components');
        const expTbody = document.getElementById('sys-modal-expenses');
        compTbody.innerHTML = '';
        expTbody.innerHTML = '';
        
        if (cust.components) {
            cust.components.forEach(comp => {
                const tr = document.createElement('tr');
                if (comp.component_type === 'Secondary') {
                    tr.innerHTML = `
                        <td>${comp.component_name}</td>
                        <td>${comp.quantity}</td>
                        <td>${formatCurrency(comp.cost_price || 0)}</td>
                        <td>${formatCurrency(comp.total_price)}</td>
                    `;
                    expTbody.appendChild(tr);
                } else {
                    const typeLabels = {
                        'Inverter': 'إنفيرتر (عاكس)',
                        'Panel': 'ألواح شمسية',
                        'Battery': 'بطاريات',
                        'Structure': 'هياكل وقواعد',
                        'Cable': 'كابلات وتمديدات',
                        'Other': 'أخرى'
                    };
                    tr.innerHTML = `
                        <td>${comp.component_name}</td>
                        <td>${typeLabels[comp.component_type] || comp.component_type}</td>
                        <td>${comp.quantity}</td>
                        <td>${formatCurrency(comp.cost_price || 0)}</td>
                        <td>${formatCurrency(comp.total_price)}</td>
                        <td>${comp.warranty_period || '-'}</td>
                    `;
                    compTbody.appendChild(tr);
                }
            });
        }
        
        if (compTbody.innerHTML === '') compTbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">لا توجد قطع أساسية</td></tr>`;
        if (expTbody.innerHTML === '') expTbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">لا توجد مصاريف ثانوية</td></tr>`;
        
        // Media
        const mediaContainer = document.getElementById('sys-modal-media-gallery');
        mediaContainer.innerHTML = '';
        if (cust.documents) {
            cust.documents.forEach(doc => {
                const isImage = doc.file_name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
                const isVideo = doc.file_name.toLowerCase().match(/\.(mp4|webm|ogg)$/);
                
                const box = document.createElement('div');
                box.style = "position: relative; width: 100%; height: 120px; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;";
                
                if (isImage) {
                    box.innerHTML = `<img src="/static/uploads/${doc.file_path}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('/static/uploads/${doc.file_path}', '_blank')">`;
                } else if (isVideo) {
                    box.innerHTML = `<video src="/static/uploads/${doc.file_path}" style="width: 100%; height: 100%; object-fit: cover;" controls></video>`;
                } else {
                    box.innerHTML = `<a href="/static/uploads/${doc.file_path}" target="_blank" style="color: var(--neon-blue); text-decoration: none; font-size: 0.8rem; text-align: center; padding: 10px;">📄 ${doc.file_name}</a>`;
                }
                
                mediaContainer.appendChild(box);
            });
        }
        
    } catch (e) {
        alert('فشل تحميل تفاصيل المنظومة');
    }
}

async function toggleSystemStatus() {
    const custId = document.getElementById('sys-modal-cust-id').value;
    if (!custId || !currentCustomerData) return;
    
    const newStatus = currentCustomerData.system_status === 'مكتمل' ? 'قيد التنفيذ' : 'مكتمل';
    
    try {
        const res = await fetch(`/api/customers/${custId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system_status: newStatus })
        });
        const data = await res.json();
        if (res.ok) {
            // alert(data.message); // removed alert to be faster
            await loadSystems();
            openSystemDetailsModal(custId); // Refresh modal
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('حدث خطأ');
    }
}

function openSystemAddSecondaryExpense() {
    const custId = document.getElementById('sys-modal-cust-id').value;
    if (!custId) return;
    closeModal('modalSystemDetails');
    viewCustomerProfile(custId, 'components');
    // Open the add component modal and set type to secondary
    setTimeout(() => {
        openCustomerAddComponentModal();
        document.getElementById('comp-type').value = 'Secondary';
    }, 500);
}

async function uploadSystemMedia(event) {
    const custId = document.getElementById('sys-modal-cust-id').value;
    const fileInput = event.target;
    if (!custId || fileInput.files.length === 0) return;
    
    for (let i = 0; i < fileInput.files.length; i++) {
        const formData = new FormData();
        formData.append('file', fileInput.files[i]);
        formData.append('customer_id', custId);
        
        try {
            await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
        } catch (e) {}
    }
    
    alert('تم رفع الوسائط بنجاح');
    fileInput.value = '';
    openSystemDetailsModal(custId); // Refresh
}

// Add Customer Modal
function openAddCustomerModal() {
    openModal('modalAddCustomer');
    document.getElementById('addCustId').value = 'SH-' + Math.floor(1000 + Math.random() * 9000);
}

async function submitAddCustomer() {
    const id = document.getElementById('addCustId').value.trim().toUpperCase();
    const name = document.getElementById('addCustName').value.trim();
    const phone = document.getElementById('addCustPhone').value.trim();
    const address = document.getElementById('addCustAddress').value.trim();
    const installation_date = document.getElementById('addCustInstallationDate').value;
    const sale_type = document.getElementById('addCustSaleType').value;
    const notes = document.getElementById('addCustNotes').value.trim();
    
    if (!id || !name || !phone) {
        alert('الاسم والهاتف والرقم التعريفي حقول مطلوبة!');
        return;
    }
    
    try {
        const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, phone, address, installation_date, sale_type, notes })
        });
        
        const data = await res.json();
        if (res.ok) {
            closeModal('modalAddCustomer');
            // Clear inputs
            document.getElementById('addCustName').value = '';
            document.getElementById('addCustPhone').value = '';
            document.getElementById('addCustAddress').value = '';
            document.getElementById('addCustInstallationDate').value = '';
            document.getElementById('addCustNotes').value = '';
            
            // Reload customer page and open their new profile to assign details!
            await loadCustomers();
            viewCustomerProfile(id, 'system');
        } else {
            alert(data.error || 'حدث خطأ أثناء حفظ العميل');
        }
    } catch (err) {
        alert('فشل الاتصال بالخادم');
    }
}

// ----------------- DETAILED CUSTOMER PROFILE -----------------
async function viewCustomerProfile(id, startTab = 'info') {
    currentCustomerId = id;
    
    // Hide all sidebar menu items active state (since we are on customer profile)
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(i => i.classList.remove('active'));
    
    // Hide all tab panes, and show pane-customer-profile
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const profilePane = document.getElementById('pane-customer-profile');
    if (profilePane) profilePane.classList.add('active');
    
    // Set active tab inside profile pane
    const tabBtns = document.querySelectorAll('#pane-customer-profile .tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-profile-tab') === startTab) {
            btn.classList.add('active');
        }
    });
    
    document.querySelectorAll('#pane-customer-profile .profile-tab-pane').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });
    const targetTabPane = document.getElementById(`profile-tab-${startTab}`);
    if (targetTabPane) {
        targetTabPane.classList.add('active');
        targetTabPane.style.display = 'block';
    }
    
    await loadProfileData();
}

function goBackToCustomers() {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    const customersMenuItem = document.querySelector('.sidebar-menu .menu-item[data-tab="customers"]');
    if (customersMenuItem) {
        customersMenuItem.classList.add('active');
    }
    
    const customersPane = document.getElementById('pane-customers');
    if (customersPane) {
        customersPane.classList.add('active');
    }
    
    activeTab = 'customers';
    updateViewHeader();
    loadCustomers();
}

async function loadProfileData() {
    if (!currentCustomerId) return;
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}`);
        if (handle401(res)) return;
        if (!res.ok) return;
        const cust = await res.json();
        currentCustomerData = cust;
        
        // 1. Title
        document.getElementById('profile-title').innerHTML = `👤 ملف العميل المحترم: <span style="color: var(--neon-blue);">${cust.name}</span> (${cust.id})`;
        
        // 2. Info Tab Inputs
        document.getElementById('prof-id').value = cust.id;
        document.getElementById('prof-name').value = cust.name;
        document.getElementById('prof-phone').value = cust.phone;
        document.getElementById('prof-address').value = cust.address || '';
        document.getElementById('prof-installation-date').value = cust.installation_date || '';
        document.getElementById('prof-sale-type').value = cust.sale_type;
        document.getElementById('prof-notes').value = cust.notes || '';
        document.getElementById('prof-installation-method').value = cust.installation_method || 'صبة سطح (سطحي)';
        document.getElementById('prof-gps-link').value = cust.gps_link || '';
        
        // Show or hide open GPS button
        const gpsBtn = document.getElementById('open-gps-btn');
        if (cust.gps_link && cust.gps_link.trim() !== '') {
            gpsBtn.style.display = 'inline-block';
        } else {
            gpsBtn.style.display = 'none';
        }
        
        // 3. Components Tab
        renderProfileComponents(cust.components);
        onComponentSourcingChange(); // Initialize the add component form dropdowns
        
        // Datalist for simple inventory integration
        await populateInventoryDatalist();
        
        // 4. Financial Tab
        if (cust.financials) {
            document.getElementById('fin-total').value = cust.financials.total_price;
            document.getElementById('fin-downpayment').value = cust.financials.down_payment;
            document.getElementById('fin-installments').value = cust.financials.total_installments;
        } else {
            document.getElementById('fin-total').value = '';
            document.getElementById('fin-downpayment').value = 0;
            document.getElementById('fin-installments').value = 0;
        }
        
        // Toggle installments generator section based on sale_type
        const genSec = document.getElementById('installment-generator-section');
        if (cust.sale_type === 'Installment') {
            genSec.style.display = 'block';
        } else {
            genSec.style.display = 'none';
        }
        
        renderProfileInstallments(cust.installments);
        
        // 5. Vault files Tab
        renderProfileVault(cust.documents);
        
        // Standalone Financials Modal syncing (refresh if open)
        if (currentFinancialsCustomerId === cust.id && document.getElementById('modalStandaloneFinancials').style.display === 'flex') {
            // Update financial inputs in modal
            if (cust.financials) {
                document.getElementById('fin-total-modal').value = cust.financials.total_price;
                document.getElementById('fin-downpayment-modal').value = cust.financials.down_payment;
                document.getElementById('fin-installments-modal').value = cust.financials.total_installments;
            }
            
            // Toggle generator section
            const genSecModal = document.getElementById('installment-generator-section-modal');
            if (cust.sale_type === 'Installment') {
                genSecModal.style.display = 'block';
            } else {
                genSecModal.style.display = 'none';
            }
            
            renderStandaloneInstallments(cust.installments);
        }
        
    } catch (err) {
        console.error("Error loading customer profile data", err);
    }
}

// 1. INFO UPDATE & DELETE
async function updateCustomerDetails() {
    const name = document.getElementById('prof-name').value.trim();
    const phone = document.getElementById('prof-phone').value.trim();
    const address = document.getElementById('prof-address').value.trim();
    const installation_date = document.getElementById('prof-installation-date').value;
    const sale_type = document.getElementById('prof-sale-type').value;
    const notes = document.getElementById('prof-notes').value.trim();
    const installation_method = document.getElementById('prof-installation-method').value;
    const gps_link = document.getElementById('prof-gps-link').value.trim();
    
    if (!name || !phone) {
        alert('الاسم ورقم الهاتف مطلوبين!');
        return;
    }
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, address, installation_date, sale_type, notes, installation_method, gps_link })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadCustomers();
            loadProfileData();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('حدث خطأ أثناء تعديل بيانات العميل');
    }
}

async function saveCustomerGPS() {
    const gps_link = document.getElementById('prof-gps-link').value.trim();
    const name = document.getElementById('prof-name').value.trim();
    const phone = document.getElementById('prof-phone').value.trim();
    const address = document.getElementById('prof-address').value.trim();
    const installation_date = document.getElementById('prof-installation-date').value;
    const sale_type = document.getElementById('prof-sale-type').value;
    const notes = document.getElementById('prof-notes').value.trim();
    const installation_method = document.getElementById('prof-installation-method').value;

    try {
        const res = await fetch(`/api/customers/${currentCustomerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, address, installation_date, sale_type, notes, installation_method, gps_link })
        });
        const data = await res.json();
        if (res.ok) {
            alert('تم حفظ رابط الموقع بنجاح!');
            loadCustomers();
            loadProfileData();
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('حدث خطأ أثناء حفظ رابط الموقع');
    }
}

function openCustomerGPS() {
    const gpsLink = document.getElementById('prof-gps-link').value.trim();
    if (gpsLink) {
        window.open(gpsLink, '_blank');
    } else {
        alert('لا يوجد رابط موقع GPS متاح لهذا العميل.');
    }
}

async function deleteCustomerFromProfile() {
    if (!confirm('🚨 هل أنت متأكد تماماً من حذف العميل؟ سيؤدي هذا إلى حذف كافة الفواتير، الأقساط، القطع، الصور والملفات المرفوعة له نهائياً ولا يمكن الاستعادة!')) {
        return;
    }
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        
        if (res.ok) {
            alert(data.message);
            closeModal('modalCustomerProfile');
            loadCustomers();
            loadDashboardStats();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('فشل حذف العميل');
    }
}

// 2. SYSTEM COMPONENTS TAB ACTIONS

let cachedSettingsLists = null;
async function fetchSettingsListsForDropdowns() {
    if (cachedSettingsLists) return cachedSettingsLists;
    try {
        const res = await fetch('/api/settings/lists');
        if (res.ok) {
            cachedSettingsLists = await res.json();
            return cachedSettingsLists;
        }
    } catch (e) {}
    return {};
}

let currentInventoryItems = [];

async function loadInventoryForComponents() {
    try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
            currentInventoryItems = await res.json();
            const datalist = document.getElementById('inventory-datalist');
            if (datalist) {
                datalist.innerHTML = '';
                currentInventoryItems.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item.item_name;
                    datalist.appendChild(opt);
                });
            }
        }
    } catch(e) {}
}

function onComponentSourcingChange() {
    const sourcing = document.getElementById('comp-sourcing').value;
    const container = document.getElementById('comp-name-container');
    
    if (sourcing === 'Stock') {
        container.innerHTML = '<input type="text" id="comp-name" class="form-control" placeholder="اكتب للبحث في المخزن..." list="inventory-datalist" oninput="onInventoryNameInput()">';
        if (currentInventoryItems.length === 0) loadInventoryForComponents();
    } else {
        onComponentTypeChange();
    }
}

function onInventoryNameInput() {
    const name = document.getElementById('comp-name').value;
    const item = currentInventoryItems.find(i => i.item_name === name);
    if (item && item.cost_price) {
        document.getElementById('comp-cost-price').value = item.cost_price;
    }
}

async function onComponentTypeChange() {
    const typeSelect = document.getElementById('comp-type');
    const container = document.getElementById('comp-name-container');
    const sourcing = document.getElementById('comp-sourcing');
    if (!typeSelect || !container || !sourcing) return;
    
    // If sourcing is stock, let the Stock logic handle the UI
    if (sourcing.value === 'Stock') {
        return;
    }
    
    const typeValue = typeSelect.value;
    
    if (typeValue === 'مواد ثانويه') {
        container.innerHTML = '<input type="text" id="comp-name" class="form-control" placeholder="اكتب اسم القطعة">';
        return;
    }
    
    container.innerHTML = '<select id="comp-name" class="form-control"><option value="">-- جاري التحميل --</option></select>';
    
    const lists = await fetchSettingsListsForDropdowns();
    const select = document.getElementById('comp-name');
    select.innerHTML = '';
    
    let items = [];
    if (typeValue === 'الواح') items = lists['panel_brands'] || [];
    else if (typeValue === 'انفيرتر') items = lists['inverter_brands'] || [];
    else if (typeValue === 'بطاريه') items = lists['battery_types'] || [];
    
    if (items.length === 0) {
        select.innerHTML = '<option value="">-- لا توجد عناصر مسجلة في الإعدادات --</option>';
    } else {
        items.forEach(i => {
            const opt = document.createElement('option');
            opt.value = i.value;
            opt.textContent = i.value;
            select.appendChild(opt);
        });
    }
}

function getComponentCategoryBadge(name, type) {
    if (type === 'Secondary' || (name && name.includes('مواد'))) {
        return '<span class="badge warning" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.2);">مواد ثانوية 🛠️</span>';
    }
    const nameLower = name ? name.toLowerCase() : '';
    if (nameLower.includes('الواح') || nameLower.includes('لوح') || nameLower.includes('solar') || nameLower.includes('ترينا') || nameLower.includes('جينكو') || nameLower.includes('لونجي')) {
        return '<span class="badge active" style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2);">ألواح ☀️</span>';
    } else if (nameLower.includes('انفيرتر') || nameLower.includes('عاكس') || nameLower.includes('inverter') || nameLower.includes('غرووات') || nameLower.includes('ديه')) {
        return '<span class="badge active" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);">انفيرتر ⚡</span>';
    } else if (nameLower.includes('بطاريه') || nameLower.includes('بطارية') || nameLower.includes('ليثيوم') || nameLower.includes('battery') || nameLower.includes('جيل')) {
        return '<span class="badge active" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);">بطارية 🔋</span>';
    }
    return '<span class="badge active" style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2);">رئيسية ☀️</span>';
}

function renderProfileComponents(components) {
    const tbody = document.getElementById('customer-components-list');
    tbody.innerHTML = '';
    
    if (components.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 15px; color: var(--text-muted);">لا توجد قطع منصبة مسجلة بعد لهذا العميل.</td></tr>`;
        return;
    }
    
    components.forEach(comp => {
        const typeBadge = getComponentCategoryBadge(comp.component_name, comp.component_type);
        const sourcingBadge = comp.sourcing_type === 'Stock' 
            ? '<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-secondary);">من المخزن 📦</span>' 
            : '<span class="badge" style="background: rgba(245, 158, 11, 0.1); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.2);">شراء مباشر 💵</span>';
            
        const totalCost = comp.cost_price * comp.quantity;
            
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold; color: #fff;">${comp.component_name}</td>
            <td>${typeBadge}</td>
            <td>${sourcingBadge}</td>
            <td style="font-weight: bold;">${comp.quantity}</td>
            <td style="color: var(--success); font-weight: bold;">🛡️ ${comp.warranty_period || 'بدون ضمان'}</td>
            <td style="color: #f59e0b; font-weight: bold;">${formatCurrency(totalCost)}</td>
            <td>
                <button class="btn btn-primary" onclick="editCustomerComponent(${comp.id})" style="padding: 4px 8px; font-size: 0.75rem; background: var(--primary);">✏️</button>
                <button class="btn btn-danger" onclick="deleteCustomerComponent(${comp.id})" style="padding: 4px 8px; font-size: 0.75rem;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

let editingComponentId = null;

function editCustomerComponent(compId) {
    const cust = currentCustomerData;
    if (!cust) return;
    const comp = cust.components.find(c => c.id === compId);
    if (!comp) return;
    
    document.getElementById('comp-qty').value = comp.quantity;
    document.getElementById('comp-cost-price').value = comp.cost_price.toLocaleString('en-US');
    document.getElementById('comp-sourcing').value = comp.sourcing_type || 'Stock';
    
    let typeVal = 'مواد ثانويه';
    if (comp.component_type === 'Primary') {
        const nameLower = comp.component_name.toLowerCase();
        if (nameLower.includes('الواح') || nameLower.includes('لوح') || nameLower.includes('solar')) typeVal = 'الواح';
        else if (nameLower.includes('انفيرتر') || nameLower.includes('عاكس')) typeVal = 'انفيرتر';
        else if (nameLower.includes('بطاريه') || nameLower.includes('بطارية')) typeVal = 'بطاريه';
    }
    document.getElementById('comp-type').value = typeVal;
    document.getElementById('comp-warranty').value = comp.warranty_period || 'بدون ضمان';
    onComponentSourcingChange();
    
    setTimeout(() => {
        const nameEl = document.getElementById('comp-name');
        if (nameEl) nameEl.value = comp.component_name;
    }, 150);
    
    editingComponentId = compId;
    document.getElementById('btn-add-comp').style.display = 'none';
    document.getElementById('btn-save-comp').style.display = 'inline-block';
    document.getElementById('btn-cancel-comp').style.display = 'inline-block';
}

function cancelEditComponent() {
    editingComponentId = null;
    document.getElementById('comp-name').value = '';
    document.getElementById('comp-qty').value = 1;
    document.getElementById('comp-cost-price').value = '';
    
    document.getElementById('btn-add-comp').style.display = 'inline-block';
    document.getElementById('btn-save-comp').style.display = 'none';
    document.getElementById('btn-cancel-comp').style.display = 'none';
}

async function saveEditedComponent() {
    if (!editingComponentId) return;
    const nameEl = document.getElementById('comp-name');
    const name = nameEl ? nameEl.value.trim() : '';
    const qty = parseInt(document.getElementById('comp-qty').value);
    const sourcing = document.getElementById('comp-sourcing').value;
    const cost_price = parsePrice(document.getElementById('comp-cost-price').value);
    const component_type_raw = document.getElementById('comp-type').value;
    const component_type = (component_type_raw === 'مواد ثانويه') ? 'Secondary' : 'Primary';
    const warranty = document.getElementById('comp-warranty').value;
    
    if (!name || qty <= 0 || isNaN(cost_price)) {
        alert('يرجى ملء كافة حقول القطعة المجهزة بشكل صحيح!');
        return;
    }
    try {
        const res = await fetch(`/api/components/${editingComponentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                component_name: name, quantity: qty, warranty_period: warranty,
                cost_price: cost_price, component_type: component_type, sourcing_type: sourcing
            })
        });
        const data = await res.json();
        if (res.ok) {
            cancelEditComponent();
            loadProfileData();
            loadCustomers();
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('حدث خطأ أثناء تعديل القطعة');
    }
}

async function populateInventoryDatalist() {
    try {
        const res = await fetch('/api/inventory');
        if (!res.ok) return;
        const items = await res.json();
        const dl = document.getElementById('inventory-datalist');
        dl.innerHTML = '';
        items.forEach(i => {
            const opt = document.createElement('option');
            opt.value = i.item_name;
            dl.appendChild(opt);
        });
    } catch (e) {}
}

async function addCustomerComponent() {
    const nameEl = document.getElementById('comp-name');
    const name = nameEl ? nameEl.value.trim() : '';
    const qty = parseInt(document.getElementById('comp-qty').value);
    const sourcing = document.getElementById('comp-sourcing').value;
    const cost_price = parsePrice(document.getElementById('comp-cost-price').value);
    const component_type_raw = document.getElementById('comp-type').value;
    const component_type = (component_type_raw === 'مواد ثانويه') ? 'Secondary' : 'Primary';
    const warranty = document.getElementById('comp-warranty').value;
    
    if (!name || qty <= 0 || isNaN(cost_price)) {
        alert('يرجى ملء كافة حقول القطعة المجهزة بشكل صحيح!');
        return;
    }
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/components`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                component_name: name, 
                quantity: qty, 
                unit_price: 0.0, 
                warranty_period: warranty,
                cost_price: cost_price,
                component_type: component_type,
                sourcing_type: sourcing
            })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('comp-name').value = '';
            document.getElementById('comp-qty').value = 1;
            document.getElementById('comp-cost-price').value = '';
            loadProfileData();
            loadCustomers();
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('حدث خطأ أثناء إضافة القطعة');
    }
}

async function deleteCustomerComponent(compId) {
    if (!confirm('هل تريد حذف هذه القطعة من نظام العميل؟')) return;
    try {
        const res = await fetch(`/api/components/${compId}`, { method: 'DELETE' });
        if (res.ok) {
            loadProfileData();
            loadCustomers();
        }
    } catch (e) {}
}

// 3. FINANCIAL TAB ACTIONS
async function saveCustomerFinancialPlan() {
    const total = parsePrice(document.getElementById('fin-total').value);
    const down = parsePrice(document.getElementById('fin-downpayment').value);
    const insts = parseInt(document.getElementById('fin-installments').value);
    
    if (isNaN(total) || isNaN(down) || isNaN(insts)) {
        alert('يرجى تعبئة المبالغ والأشهر كقيم عددية صحيحة!');
        return;
    }
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/financials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ total_price: total, down_payment: down, total_installments: insts })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadProfileData();
            loadCustomers();
            loadDashboardStats();
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('حدث خطأ في الشبكة');
    }
}

async function generateCustomerInstallments() {
    const startDate = document.getElementById('inst-start-date').value;
    if (!startDate) {
        alert('يرجى تحديد تاريخ استحقاق أول قسط شهري لجدولة المبالغ!');
        return;
    }
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/generate-installments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: startDate })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadProfileData();
            loadDashboardStats();
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('حدث خطأ أثناء توليد الأقساط');
    }
}

function renderProfileInstallments(installments) {
    const tbody = document.getElementById('customer-installments-list');
    tbody.innerHTML = '';
    
    if (installments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 15px; color: var(--text-muted);">لا توجد أقساط مجدولة للعميل حالياً.</td></tr>`;
        return;
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    installments.forEach(inst => {
        let statusBadge = '';
        if (inst.status === 'Paid') {
            statusBadge = '<span class="badge success">مدفوع ✔️</span>';
        } else if (inst.status === 'Overdue' || inst.due_date < todayStr) {
            statusBadge = '<span class="badge danger">متأخر ⚠️</span>';
        } else if (inst.due_date.slice(0,7) === todayStr.slice(0,7)) {
            statusBadge = '<span class="badge warning">مستحق ⏳</span>';
        } else {
            statusBadge = '<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.1);">قادم 🗓️</span>';
        }
            
        const payBtn = inst.status === 'Paid' 
            ? `<button class="btn btn-success" onclick="printReceiptA4(${inst.id})" style="padding: 4px 8px; font-size: 0.75rem;">🖨️ طباعة الوصل</button>` 
            : `<button class="btn btn-primary" onclick="payCustomerInstallment(${inst.id})" style="padding: 4px 8px; font-size: 0.75rem; background: var(--success); border:none;">💰 تسجيل السداد</button>`;
            
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold; color: #fff;">القسط #${inst.installment_number}</td>
            <td style="font-weight: bold; color: var(--neon-blue);">${formatCurrency(inst.amount)}</td>
            <td style="font-weight: bold;">${inst.due_date}</td>
            <td>${statusBadge}</td>
            <td>${inst.paid_date || '-'}</td>
            <td>
                <button class="btn btn-secondary" onclick="openEditInstallmentModal(${inst.id}, ${inst.amount}, '${inst.due_date}')" style="padding: 4px 8px; font-size: 0.75rem;">✏️</button>
            </td>
            <td>${payBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Edit Individual Installment Modals
function openEditInstallmentModal(id, amount, date) {
    document.getElementById('edit-inst-id').value = id;
    document.getElementById('edit-inst-amount').value = amount;
    document.getElementById('edit-inst-date').value = date;
    openModal('modalEditInstallment');
}

async function submitEditInstallment() {
    const id = document.getElementById('edit-inst-id').value;
    const amount = parseFloat(document.getElementById('edit-inst-amount').value);
    const date = document.getElementById('edit-inst-date').value;
    
    if (isNaN(amount) || !date) {
        alert('يرجى إدخال قيم صحيحة!');
        return;
    }
    
    try {
        const res = await fetch(`/api/installments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount, due_date: date })
        });
        if (res.ok) {
            closeModal('modalEditInstallment');
            loadProfileData();
            loadDashboardStats();
        }
    } catch (e) {}
}

async function payCustomerInstallment(instId) {
    if (!confirm('هل تريد تسجيل استلام دفعة هذا القسط وتوليد وصل مالي له؟')) return;
    
    try {
        const res = await fetch(`/api/installments/${instId}/pay`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadProfileData();
            loadDashboardStats();
            
            // Print receipt immediately
            printReceiptA4(instId);
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('حدث خطأ أثناء السداد');
    }
}

// 5. VAULT FILES TAB ACTIONS
function renderProfileVault(documents) {
    const grid = document.getElementById('customer-vault-files');
    grid.innerHTML = '';
    
    if (documents.length === 0) {
        grid.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); padding: 25px; text-align: center; grid-column: 1 / -1;">لا توجد مستندات أو صور مرفوعة لهذا العميل بعد.</p>`;
        return;
    }
    
    documents.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'vault-item';
        
        let icon = '📁';
        let preview = '';
        
        if (doc.file_type === 'صورة') {
            icon = '🖼️';
            preview = `<div style="width: 100%; height: 90px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: rgba(0,0,0,0.2);">
                <img src="/static/uploads/${doc.file_path}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>`;
        } else {
            icon = '📄';
            preview = `<div style="font-size: 2.2rem; margin-bottom: 8px;">📄</div>`;
        }
        
        card.innerHTML = `
            ${preview}
            <div class="name" title="${doc.file_name}">${doc.file_name}</div>
            <div class="actions">
                <a href="/static/uploads/${doc.file_path}" target="_blank" class="btn btn-success" style="padding: 4px 8px; font-size: 0.75rem;">👀 عرض</a>
                <button class="btn btn-danger" onclick="deleteVaultFile(${doc.id})" style="padding: 4px 8px; font-size: 0.75rem;">🗑️</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function uploadCustomerVaultFile() {
    const fileInput = document.getElementById('vault-file-input');
    if (fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            fileInput.value = '';
            loadProfileData();
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('فشل رفع الملف للأسف');
    }
}

async function deleteVaultFile(docId) {
    if (!confirm('هل أنت متأكد من حذف هذا الملف نهائياً؟')) return;
    try {
        const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
        if (res.ok) {
            loadProfileData();
        }
    } catch (e) {}
}

function compileTemplateString(templateStr, companyInfo) {
    if (!templateStr) return '';
    const today = new Date().toLocaleDateString('ar-IQ');
    let logoTag = `☀️`;
    if (companyInfo && companyInfo.logo) {
        logoTag = `<img src="/static/uploads/${companyInfo.logo}" style="max-height: 70px; object-fit: contain; display: block;">`;
    }
    const companyName = (companyInfo && companyInfo.name) ? companyInfo.name : currentCompanyName;
    
    return templateStr
        .replace(/{اسم_الشركة}/g, companyName)
        .replace(/{هاتف_الشركة}/g, (companyInfo && companyInfo.phone) ? companyInfo.phone : '')
        .replace(/{عنوان_الشركة}/g, (companyInfo && companyInfo.address) ? companyInfo.address : '')
        .replace(/{شعار_الشركة}/g, logoTag)
        .replace(/{تاريخ_اليوم}/g, today);
}

// ----------------- A4 CUSTOM WYSIWYG PRINTING SYSTEM -----------------
function compilePrintHeaderAndFooter(headerTemplate, footerTemplate, companyInfo, docType) {
    let headerHtml = '';
    let footerHtml = '';
    
    // Choose correct header/footer dynamic image keys
    const headerKey = `print_${docType}_header_img`;
    const footerKey = `print_${docType}_footer_img`;
    
    if (companyInfo && companyInfo[headerKey]) {
        headerHtml = `<div class="print-header-image-container" style="width: 100%; margin-bottom: 25px; text-align: center;">
            <img src="/static/uploads/${companyInfo[headerKey]}" style="width: 100%; max-height: 120mm; object-fit: contain; display: block;">
        </div>`;
    } else if (headerTemplate && headerTemplate.trim() !== '') {
        headerHtml = compileTemplateString(headerTemplate, companyInfo);
    } else {
        // Fallback default text header if no image is uploaded
        const companyName = (companyInfo && companyInfo.name) ? companyInfo.name : currentCompanyName;
        const companyPhone = (companyInfo && companyInfo.phone) ? companyInfo.phone : '';
        const companyAddress = (companyInfo && companyInfo.address) ? companyInfo.address : '';
        let logoTag = `☀️`;
        if (companyInfo && companyInfo.logo) {
            logoTag = `<img src="/static/uploads/${companyInfo.logo}" style="max-height: 70px; object-fit: contain; display: block;">`;
        }
        
        headerHtml = `<div class="print-custom-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0B2545; padding-bottom: 15px; margin-bottom: 20px; direction: rtl; font-family: 'Cairo', sans-serif;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="print-logo-container" style="display: flex; align-items: center;">
                    ${logoTag}
                </div>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 18pt; font-weight: 800; color: #0B2545; line-height: 1.2;">${companyName}</span>
                    <span style="font-size: 9pt; color: #555; font-weight: bold;">أنظمة طاقة شمسية هجينة وذكية</span>
                </div>
            </div>
            <div style="text-align: left; font-size: 9.5pt; color: #333; line-height: 1.6;">
                <div style="font-weight: bold; color: #0B2545; font-size: 11pt; margin-bottom: 4px;">قسم المبيعات والتسليم</div>
                <strong>الهاتف:</strong> ${companyPhone}<br>
                <strong>العنوان:</strong> ${companyAddress}
            </div>
        </div>`;
    }
    
    if (companyInfo && companyInfo[footerKey]) {
        footerHtml = `<div class="print-footer-image-container" style="width: 100%; margin-top: 35px; text-align: center;">
            <img src="/static/uploads/${companyInfo[footerKey]}" style="width: 100%; max-height: 50mm; object-fit: contain; display: block;">
        </div>`;
    } else if (footerTemplate && footerTemplate.trim() !== '') {
        footerHtml = compileTemplateString(footerTemplate, companyInfo);
    } else {
        // Fallback default text footer if no image is uploaded
        const companyName = (companyInfo && companyInfo.name) ? companyInfo.name : currentCompanyName;
        const companyPhone = (companyInfo && companyInfo.phone) ? companyInfo.phone : '';
        const today = new Date().toLocaleDateString('ar-IQ');
        
        footerHtml = `<div class="print-custom-footer" style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 40px; direction: rtl; font-family: 'Cairo', sans-serif; font-size: 8.5pt; color: #666; display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div>وثيقة رسمية صادرة من شركة ${companyName} للطاقة المستدامة ☀️</div>
            <div style="text-align: left;">
                تاريخ الطباعة: ${today} | هاتف: ${companyPhone}
            </div>
        </div>`;
    }
    
    return { headerHtml, footerHtml };
}

async function printContractA4() {
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/compile-docs`);
        if (!res.ok) return;
        const data = await res.json();
        
        const { headerHtml, footerHtml } = compilePrintHeaderAndFooter(data.print_header_template, data.print_footer_template, data.company_info, 'contract');
        
        const printArea = document.getElementById('print-area-container');
        printArea.innerHTML = `
            <div class="print-sheet-a4">
                ${headerHtml}
                <h1 class="print-title">عقد اتفاق وتوريد نظام طاقة شمسية</h1>
                <div class="print-text-block">${data.compiled_contract}</div>
                <div class="print-signatures">
                    <div class="print-signature-box">الطرف الأول (الشركة المجهزة)</div>
                    <div class="print-signature-box">الطرف الثاني (العميل المتعاقد)</div>
                </div>
                ${footerHtml}
            </div>
        `;
        
        setTimeout(() => { window.print(); }, 500);
    } catch (e) {
        alert('حدث خطأ أثناء معالجة العقد للطباعة');
    }
}

async function printWarrantyA4() {
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/compile-docs`);
        if (!res.ok) return;
        const data = await res.json();
        
        const { headerHtml, footerHtml } = compilePrintHeaderAndFooter(data.print_header_template, data.print_footer_template, data.company_info, 'warranty');
        
        const printArea = document.getElementById('print-area-container');
        printArea.innerHTML = `
            <div class="print-sheet-a4">
                ${headerHtml}
                <h1 class="print-title">شهادة الضمان والجودة للأجهزة والأنظمة</h1>
                <div class="print-text-block">${data.compiled_warranty}</div>
                <div class="print-signatures">
                    <div class="print-signature-box">ختم وتوقيع شركة ${data.company_info.name}</div>
                    <div class="print-signature-box">توقيع العميل المستلم</div>
                </div>
                ${footerHtml}
            </div>
        `;
        
        setTimeout(() => { window.print(); }, 500);
    } catch (e) {
        alert('حدث خطأ أثناء توليد شهادة الضمان');
    }
}

// Print single receipt A4
async function printReceiptA4(instId) {
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}`);
        if (!res.ok) return;
        const cust = await res.json();
        
        const inst = cust.installments.find(i => i.id === instId);
        if (!inst) return;
        
        const res2 = await fetch(`/api/settings`);
        const company = res2.ok ? await res2.json() : {};
        
        const { headerHtml, footerHtml } = compilePrintHeaderAndFooter(company.print_header_template, company.print_footer_template, {
            name: company.company_name,
            phone: company.company_phone,
            address: company.company_address,
            logo: company.company_logo,
            print_receipt_header_img: company.print_receipt_header_img,
            print_receipt_footer_img: company.print_receipt_footer_img
        }, 'receipt');
        
        const printArea = document.getElementById('print-area-container');
        printArea.innerHTML = `
            <div class="print-sheet-a4" style="min-height: 150mm; border: 2px solid #000; padding: 15mm; margin-top: 20px;">
                ${headerHtml}
                <h1 class="print-title" style="margin-bottom: 25px;">وصل قبض مالي للأقساط الشهرية</h1>
                
                <table class="print-table" style="margin-bottom: 30px;">
                    <tr>
                        <td style="width: 25%; background:#f2f2f2; font-weight:bold;">وصل قبض رقم:</td>
                        <td style="width: 25%;">REC-${inst.id}</td>
                        <td style="width: 25%; background:#f2f2f2; font-weight:bold;">تاريخ القبض:</td>
                        <td style="width: 25%; font-weight:bold;">${inst.paid_date}</td>
                    </tr>
                    <tr>
                        <td style="background:#f2f2f2; font-weight:bold;">استلمنا من العميل:</td>
                        <td colspan="3" style="font-weight:bold; font-size: 12pt;">${cust.name} (رقم العميل: ${cust.id})</td>
                    </tr>
                    <tr>
                        <td style="background:#f2f2f2; font-weight:bold;">قيمة الدفعة المقبوضة:</td>
                        <td style="font-weight:bold; color:green; font-size:13pt;">${formatCurrency(inst.amount)}</td>
                        <td style="background:#f2f2f2; font-weight:bold;">وذلك تسديداً لـ:</td>
                        <td style="font-weight:bold;">القسط رقم #${inst.installment_number}</td>
                    </tr>
                    <tr>
                        <td style="background:#f2f2f2; font-weight:bold;">الدفعة الأولى (المقدمة):</td>
                        <td style="font-weight:bold; color:#0284c7;">${formatCurrency(cust.financials.down_payment)}</td>
                        <td style="background:#f2f2f2; font-weight:bold;">المجموع المالي للتعاقد:</td>
                        <td style="font-weight:bold;">${formatCurrency(cust.financials.total_price)}</td>
                    </tr>
                </table>

                <div class="print-signatures" style="margin-top: 40px;">
                    <div class="print-signature-box" style="border:none;">المحاسب المسؤول لـ ${company.company_name || currentCompanyName}: ________________</div>
                </div>
                ${footerHtml}
            </div>
        `;
        
        setTimeout(() => { window.print(); }, 500);
    } catch (e) {
        alert('حدث خطأ أثناء طباعة الوصل مالي');
    }
}

// ----------------- BULK NOTIFICATIONS / GENERAL ALERTS -----------------
async function loadBulkCustomersList() {
    try {
        const res = await fetch('/api/customers');
        if (!res.ok) return;
        const customers = await res.json();
        
        const container = document.getElementById('bulkCustomersList');
        container.innerHTML = '';
        selectedBulkCustomers.clear();
        
        if (customers.length === 0) {
            container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center;">لا يوجد عملاء مضافين في النظام بعد.</p>`;
            return;
        }
        
        customers.forEach(c => {
            selectedBulkCustomers.add(c.id); // Select all by default
            
            const div = document.createElement('div');
            div.className = 'exclusion-item';
            div.innerHTML = `
                <input type="checkbox" id="bulk-chk-${c.id}" checked onchange="toggleBulkCustomerCheckbox('${c.id}')">
                <label for="bulk-chk-${c.id}" style="cursor:pointer; display: flex; justify-content: space-between; flex-grow: 1; font-weight:bold;">
                    <span>${c.name} (${c.id})</span>
                    <span style="color: var(--text-muted); font-size: 0.8rem;">هاتف: ${c.phone}</span>
                </label>
            `;
            container.appendChild(div);
        });
    } catch (e) {}
}

function toggleBulkCustomerCheckbox(id) {
    if (selectedBulkCustomers.has(id)) {
        selectedBulkCustomers.delete(id);
    } else {
        selectedBulkCustomers.add(id);
    }
}

function toggleSelectAllBulk(select = true) {
    const checks = document.querySelectorAll('.exclusion-item input[type="checkbox"]');
    checks.forEach(c => {
        c.checked = select;
        const id = c.id.replace('bulk-chk-', '');
        if (select) {
            selectedBulkCustomers.add(id);
        } else {
            selectedBulkCustomers.delete(id);
        }
    });
}

function dispatchBulkMessages() {
    const text = document.getElementById('bulkMessageText').value.trim();
    if (!text) {
        alert('يرجى كتابة نص الرسالة أولاً!');
        return;
    }
    
    if (selectedBulkCustomers.size === 0) {
        alert('يرجى اختيار عميل واحد على الأقل لإرسال التنبيه إليه!');
        return;
    }
    
    const targets = allCustomers.filter(c => selectedBulkCustomers.has(c.id));
    if (targets.length === 0) return;
    
    alert(`💡 سيتم الآن فتح نوافذ إرسال الواتساب تتابعاً لـ (${targets.length}) عملاء. سيفتح النظام نافذة الواتساب لكل عميل بضغطة زر وتلقائياً.`);
    
    targets.forEach((t, index) => {
        setTimeout(() => {
            let cleanPhone = t.phone.trim().replace(/[\s\-\+]/g, '');
            if (cleanPhone.startsWith('07')) {
                cleanPhone = '964' + cleanPhone.substring(1);
            }
            
            const message = `عزيزي العميل المحترم *${t.name}* ☀️\n\n${text}\n\nنظام ${currentCompanyName}.`;
            const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
            
            // Open window
            window.open(url, '_blank');
        }, index * 1000); // 1-second delay between tabs to avoid browser block
    });
}

// ----------------- SIMPLE INVENTORY -----------------
async function loadInventory() {
    try {
        const res = await fetch('/api/inventory');
        if (!res.ok) return;
        const items = await res.json();
        
        const tbody = document.getElementById('inventory-table-body');
        tbody.innerHTML = '';
        
        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 25px;">المخزن فارغ حالياً، اضغط لإضافة مواد جديدة.</td></tr>`;
            return;
        }
        
        items.forEach(item => {
            const tr = document.createElement('tr');
            
            let catName = 'مستلزمات أخرى';
            if (item.item_category === 'Panel') catName = 'ألواح طاقة شمسية';
            else if (item.item_category === 'Inverter') catName = 'إنفرتر وعواكس';
            else if (item.item_category === 'Battery') catName = 'بطاريات شحن';
            else if (item.item_category === 'Structure') catName = 'هياكل وقواعد تثبيت';
            else if (item.item_category === 'Cable') catName = 'كابلات وتمديدات';
            
            let stockStyle = item.quantity_on_hand <= (item.min_threshold || 5) ? "color: #ef4444; font-weight: 800; font-size: 1.1rem;" : "color: var(--neon-blue); font-weight: 800; font-size: 1.1rem;";
            let alertIcon = item.quantity_on_hand <= (item.min_threshold || 5) ? " ⚠️ (نقص)" : "";
            
            tr.innerHTML = `
                <td style="font-weight: bold; color: #fff;">${item.item_name}</td>
                <td>${catName}</td>
                <td style="${stockStyle}">${item.quantity_on_hand} قطع ${alertIcon}</td>
                <td style="color: #10b981; font-weight: bold;">${formatCurrency(item.cost_price || 0)}</td>
                <td>${item.notes || '-'}</td>
                <td>
                    <button class="btn btn-danger" onclick="deleteInventoryItem(${item.id})" style="padding: 4px 8px; font-size: 0.75rem;">🗑️ حذف</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {}
}

function openAddInventoryModal() {
    openModal('modalAddInventory');
    onAddInventoryCategoryChange();
}

async function onAddInventoryCategoryChange() {
    const categorySelect = document.getElementById('addInvCategory');
    const container = document.getElementById('add-inv-name-container');
    if (!categorySelect || !container) return;
    
    const catValue = categorySelect.value;
    
    if (['Panel', 'Inverter', 'Battery'].includes(catValue)) {
        container.innerHTML = '<select id="addInvName" class="form-control"><option value="">-- جاري التحميل --</option></select>';
        
        const lists = await fetchSettingsListsForDropdowns();
        const select = document.getElementById('addInvName');
        if(!select) return;
        select.innerHTML = '';
        
        let items = [];
        if (catValue === 'Panel') items = lists['panel_brands'] || [];
        else if (catValue === 'Inverter') items = lists['inverter_brands'] || [];
        else if (catValue === 'Battery') items = lists['battery_types'] || [];
        
        if (items.length === 0) {
            select.innerHTML = '<option value="">-- لا توجد عناصر مسجلة في الإعدادات --</option>';
        } else {
            items.forEach(i => {
                const opt = document.createElement('option');
                opt.value = i.value;
                opt.textContent = i.value;
                select.appendChild(opt);
            });
        }
    } else {
        container.innerHTML = '<input type="text" id="addInvName" class="form-control" placeholder="اسم المادة وموديلها بالتحديد">';
    }
}

async function submitAddInventory() {
    const item_name = document.getElementById('addInvName').value.trim();
    const item_category = document.getElementById('addInvCategory').value;
    const quantity_on_hand = parseInt(document.getElementById('addInvQty').value);
    const min_threshold = parseInt(document.getElementById('addInvThreshold').value);
    const cost_price = parseFloat(document.getElementById('addInvCostPrice').value);
    const notes = document.getElementById('addInvNotes').value.trim();
    
    if (!item_name || isNaN(quantity_on_hand)) {
        alert('اسم المادة والكمية حقول مطلوبة!');
        return;
    }
    
    try {
        const res = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_name, item_category, quantity_on_hand, min_threshold, cost_price, notes })
        });
        if (res.ok) {
            closeModal('modalAddInventory');
            document.getElementById('addInvName').value = '';
            document.getElementById('addInvQty').value = '0';
            document.getElementById('addInvCostPrice').value = '0';
            document.getElementById('addInvThreshold').value = '5';
            document.getElementById('addInvNotes').value = '';
            loadInventory();
        }
    } catch (e) {}
}

async function deleteInventoryItem(itemId) {
    if (!confirm('هل تريد مسح هذه المادة تماماً من المخزن؟')) return;
    try {
        const res = await fetch(`/api/inventory/${itemId}`, { method: 'DELETE' });
        if (res.ok) loadInventory();
    } catch (e) {}
}

async function openTransactionsLogModal() {
    openModal('modalTransactionsLog');
    try {
        const res = await fetch('/api/inventory/transactions');
        if (!res.ok) return;
        const trans = await res.json();
        const tbody = document.getElementById('transactions-log-body');
        tbody.innerHTML = '';
        if(trans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد حركات مسجلة للمخزن بعد.</td></tr>';
            return;
        }
        trans.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${t.transaction_date.substring(0, 16)}</td>
                <td style="font-weight:bold;">${t.item_name}</td>
                <td><span style="background: rgba(255,255,255,0.1); padding: 3px 6px; border-radius: 4px;">${t.transaction_type}</span></td>
                <td style="font-weight:bold; color:var(--neon-blue);">${t.quantity} قطع</td>
                <td>${t.related_customer ? 'عميل ID: ' + t.related_customer : '-'}</td>
                <td>${t.notes || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {}
}

// ----------------- EXPENSES LEDGER -----------------
async function loadExpenses() {
    try {
        // Load categories dynamic dropdown first
        const resList = await fetch('/api/settings/lists');
        if (resList.ok) {
            const lists = await resList.json();
            const select = document.getElementById('addExpCategory');
            select.innerHTML = '';
            const cats = lists.expense_categories || [];
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.value;
                opt.innerText = c.value;
                select.appendChild(opt);
            });
        }
        
        const res = await fetch('/api/expenses');
        if (!res.ok) return;
        const expenses = await res.json();
        
        const tbody = document.getElementById('expenses-table-body');
        tbody.innerHTML = '';
        
        if (expenses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px;">لا توجد مصاريف مسجلة للشركة.</td></tr>`;
            return;
        }
        
        expenses.forEach(exp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold; color: #fff;">${exp.item_name}</td>
                <td>${exp.category}</td>
                <td style="color: #f87171; font-weight: bold;">${formatCurrency(exp.amount)}</td>
                <td>${exp.expense_date}</td>
                <td>${exp.notes || '-'}</td>
                <td>
                    <button class="btn btn-danger" onclick="deleteExpense(${exp.id})" style="padding: 4px 8px; font-size: 0.75rem;">🗑️ مسح</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {}
}

function openAddExpenseModal() {
    openModal('modalAddExpense');
    document.getElementById('addExpDate').value = new Date().toISOString().substring(0, 10);
}

async function submitAddExpense() {
    const item_name = document.getElementById('addExpName').value.trim();
    const category = document.getElementById('addExpCategory').value;
    const amount = parseFloat(document.getElementById('addExpAmount').value);
    const expense_date = document.getElementById('addExpDate').value;
    const notes = document.getElementById('addExpNotes').value.trim();
    
    if (!item_name || isNaN(amount) || amount <= 0 || !expense_date) {
        alert('يرجى ملء البند، المبلغ والتاريخ بشكل صحيح!');
        return;
    }
    
    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_name, category, amount, expense_date, notes })
        });
        const data = await res.json();
        if (res.ok) {
            closeModal('modalAddExpense');
            document.getElementById('addExpName').value = '';
            document.getElementById('addExpAmount').value = '';
            document.getElementById('addExpNotes').value = '';
            loadExpenses();
            loadDashboardStats();
        } else {
            alert(data.error);
        }
    } catch (e) {}
}

async function deleteExpense(expId) {
    if (!confirm('هل تريد حذف هذا المصروف؟')) return;
    try {
        const res = await fetch(`/api/expenses/${expId}`, { method: 'DELETE' });
        if (res.ok) {
            loadExpenses();
            loadDashboardStats();
        }
    } catch (e) {}
}

// ----------------- GENERAL SETTINGS & TEMPLATES -----------------
async function loadSettings() {
    try {
        // Load general configs
        const res = await fetch('/api/settings');
        if (res.ok) {
            const configs = await res.json();
            currentCompanyName = configs.company_name || 'هايبرد إينرجي';
            currentEngineerName = configs.engineer_name || 'أحمد علي';
            
            document.getElementById('sett-company-name').value = configs.company_name || '';
            document.getElementById('sett-company-phone').value = configs.company_phone || '';
            document.getElementById('sett-company-address').value = configs.company_address || '';
            document.getElementById('sett-contract-template').value = configs.contract_template || '';
            document.getElementById('sett-warranty-template').value = configs.warranty_template || '';
            document.getElementById('sett-admin-password').value = ''; // clear password view
            
            const settEngInput = document.getElementById('sett-engineer-name');
            if (settEngInput) settEngInput.value = currentEngineerName;
            
            // Set dynamic welcome subtitle
            updateViewHeader();
            
            // Set dynamic sidebar logo and settings preview
            applyCompanyLogo(configs.company_logo);
            
            // Set dynamic print header and footer image previews for all 4 document types
            applyPrintImagePreview('contract_header', configs.print_contract_header_img);
            applyPrintImagePreview('contract_footer', configs.print_contract_footer_img);
            applyPrintImagePreview('warranty_header', configs.print_warranty_header_img);
            applyPrintImagePreview('warranty_footer', configs.print_warranty_footer_img);
            applyPrintImagePreview('receipt_header', configs.print_receipt_header_img);
            applyPrintImagePreview('receipt_footer', configs.print_receipt_footer_img);
        }
        
        // Load dynamic list boxes
        loadSettingsListCategories();
        
    } catch (e) {}
}

async function saveGeneralSettings() {
    const name = document.getElementById('sett-company-name').value.trim();
    const phone = document.getElementById('sett-company-phone').value.trim();
    const address = document.getElementById('sett-company-address').value.trim();
    const pass = document.getElementById('sett-admin-password').value;
    const engineerName = document.getElementById('sett-engineer-name').value.trim();
    
    if (!name) {
        alert('اسم الشركة حقل مطلوب!');
        return;
    }
    
    const payload = {
        company_name: name,
        company_phone: phone,
        company_address: address,
        engineer_name: engineerName
    };
    
    if (pass.trim() !== '') {
        payload.admin_password = pass;
    }
    
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadSettings();
        }
    } catch (e) {}
}

async function saveTemplatesSettings() {
    const contract = document.getElementById('sett-contract-template').value;
    const warranty = document.getElementById('sett-warranty-template').value;
    
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contract_template: contract, 
                warranty_template: warranty
            })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadSettings();
        }
    } catch (e) {}
}

async function uploadPrintImage(type) {
    const fileInput = document.getElementById(`sett-print-${type}-file`);
    if (fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch(`/api/settings/upload-print-image/${type}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            applyPrintImagePreview(type, data.image_path);
            fileInput.value = '';
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('حدث خطأ أثناء رفع الصورة');
    }
}

async function uploadCompanyLogo() {
    const fileInput = document.getElementById('sett-company-logo-file');
    if (!fileInput || fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch('/api/settings/logo', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            applyCompanyLogo(data.logo_path);
            
            // update global currentCompanyLogo so sidebar is updated
            window.currentCompanyLogo = data.logo_path;
            
            // update sidebar immediately
            const sidebarLogo = document.querySelector('.sidebar-logo img');
            if (sidebarLogo) {
                sidebarLogo.src = '/static/uploads/' + data.logo_path;
            }
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('حدث خطأ أثناء رفع الشعار');
    }
}

function applyCompanyLogo(filename) {
    const placeholder = document.getElementById('sett-company-logo-placeholder');
    const img = document.getElementById('sett-company-logo-preview');
    if (placeholder && img) {
        if (filename) {
            placeholder.style.display = 'none';
            img.src = `/static/uploads/${filename}`;
            img.style.display = 'block';
        } else {
            placeholder.style.display = 'block';
            img.src = '';
            img.style.display = 'none';
        }
    }
    
    // Update sidebar
    window.currentCompanyLogo = filename;
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
        if (filename) {
            sidebarHeader.innerHTML = `<img src="/static/uploads/${filename}" style="max-height: 40px; object-fit: contain; margin-left: 10px;"> <span class="logo-text">${currentCompanyName}</span>`;
        } else {
            sidebarHeader.innerHTML = `<span class="logo-icon">⚡☀️</span> <span class="logo-text">${currentCompanyName}</span>`;
        }
    }
}

function applyPrintImagePreview(type, filename) {
    const placeholder = document.getElementById(`print-${type}-placeholder`);
    const img = document.getElementById(`print-${type}-img-preview`);
    
    if (filename) {
        placeholder.style.display = 'none';
        img.src = `/static/uploads/${filename}`;
        img.style.display = 'block';
    } else {
        placeholder.style.display = 'block';
        img.src = '';
        img.style.display = 'none';
    }
}

async function loadSettingsListCategories() {
    try {
        const res = await fetch('/api/settings/lists');
        if (!res.ok) return;
        const lists = await res.json();
        
        const mapping = {
            panel_brands: 'list-panel-brands',
            inverter_brands: 'list-inverter-brands',
            battery_types: 'list-battery-types',
            expense_categories: 'list-expense-categories'
        };
        
        for (const [key, containerId] of Object.entries(mapping)) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            
            const items = lists[key] || [];
            if (items.length === 0) {
                container.innerHTML = `<p style="font-size:0.75rem; color:var(--text-muted);">لا توجد عناصر.</p>`;
            } else {
                items.forEach(i => {
                    const div = document.createElement('div');
                    div.className = 'dynamic-list-item';
                    div.innerHTML = `
                        <span>${i.value}</span>
                        <button onclick="deleteListItem(${i.id})">🗑️</button>
                    `;
                    container.appendChild(div);
                });
            }
        }
    } catch (e) {}
}

async function addListItem(listName, inputId) {
    const input = document.getElementById(inputId);
    const value = input.value.trim();
    
    if (!value) return;
    
    try {
        const res = await fetch('/api/settings/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list_name: listName, item_value: value })
        });
        const data = await res.json();
        if (res.ok) {
            input.value = '';
            loadSettingsListCategories();
        } else {
            alert(data.error);
        }
    } catch (e) {}
}

async function deleteListItem(itemId) {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;
    try {
        const res = await fetch(`/api/settings/lists/${itemId}`, { method: 'DELETE' });
        if (res.ok) {
            loadSettingsListCategories();
        }
    } catch (e) {}
}

// ----------------- AUTHENTICATION: LOGOUT -----------------
function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', async function() {
        if (!confirm('هل تود تسجيل الخروج والعودة لشاشة الدخول؟')) return;
        try {
            const res = await fetch('/api/logout', { method: 'POST' });
            if (res.ok) {
                window.location.reload();
            }
        } catch (e) {}
    });
}

// ----------------- MODALS GENERAL HELPERS -----------------
function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.style.display = 'flex';
    }
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.style.display = 'none';
        
        // Custom resets
        if (id === 'modalCustomerProfile') {
            currentCustomerId = null;
        }
    }
}

// ----------------- CLOUDFLARE R2 BACKUP SYSTEMS -----------------
async function loadR2BackupStatus() {
    try {
        const res = await fetch('/api/settings/r2-status');
        if (!res.ok) return;
        const status = await res.json();
        
        const statusTextEl = document.getElementById('r2-status-text');
        const lastBackupEl = document.getElementById('r2-last-backup');
        
        const accountIdInput = document.getElementById('r2-account-id');
        const accessKeyIdInput = document.getElementById('r2-access-key-id');
        const secretAccessKeyInput = document.getElementById('r2-secret-access-key');
        const bucketNameInput = document.getElementById('r2-bucket-name');
        const chkEnabled = document.getElementById('chk-r2-enabled');
        
        if (statusTextEl) {
            if (status.enabled) {
                statusTextEl.innerHTML = 'مفعل وجاهز ✅';
                statusTextEl.style.color = '#38bdf8';
            } else {
                statusTextEl.innerHTML = 'غير مفعل ❌';
                statusTextEl.style.color = '#f43f5e';
            }
        }
        
        if (lastBackupEl) {
            lastBackupEl.innerHTML = status.last_backup;
            lastBackupEl.style.color = status.last_backup.includes('لم يتم') ? 'var(--text-muted)' : '#38bdf8';
        }
        
        if (accountIdInput) accountIdInput.value = status.account_id || '';
        if (accessKeyIdInput) accessKeyIdInput.value = status.access_key_id || '';
        if (secretAccessKeyInput) secretAccessKeyInput.value = status.secret_access_key || '';
        if (bucketNameInput) bucketNameInput.value = status.bucket_name || '';
        if (chkEnabled) chkEnabled.checked = status.enabled;
        
    } catch (e) {
        console.error("Error loading R2 status:", e);
    }
}

async function saveR2Settings() {
    const accountId = document.getElementById('r2-account-id')?.value || '';
    const accessKeyId = document.getElementById('r2-access-key-id')?.value || '';
    const secretAccessKey = document.getElementById('r2-secret-access-key')?.value || '';
    const bucketName = document.getElementById('r2-bucket-name')?.value || '';
    const enabled = document.getElementById('chk-r2-enabled')?.checked || false;
    
    try {
        const res = await fetch('/api/settings/r2-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_id: accountId,
                access_key_id: accessKeyId,
                secret_access_key: secretAccessKey,
                bucket_name: bucketName,
                enabled: enabled
            })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadR2BackupStatus();
        } else {
            alert(data.error || 'حدث خطأ أثناء حفظ الإعدادات');
        }
    } catch (e) {
        alert('حدث خطأ أثناء الاتصال بالخادم لحفظ الإعدادات');
    }
}

async function triggerR2Backup() {
    const btnBackup = document.getElementById('btn-r2-backup');
    if (!btnBackup) return;
    const originalText = btnBackup.innerHTML;
    btnBackup.innerHTML = '⏳ جاري رفع النسخة الاحتياطية...';
    btnBackup.setAttribute('disabled', 'true');
    
    try {
        const res = await fetch('/api/settings/r2-backup', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadR2BackupStatus();
        } else {
            alert(data.error || 'فشل رفع النسخة الاحتياطية');
        }
    } catch (e) {
        alert('حدث خطأ أثناء الاتصال بالخادم لرفع النسخة الاحتياطية');
    } finally {
        btnBackup.innerHTML = originalText;
        btnBackup.removeAttribute('disabled');
    }
}

// Mobile sidebar toggle function
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// ----------------- BROWSER WEB NOTIFICATIONS SYSTEM -----------------
function initNotifications() {
    if (!("Notification" in window)) {
        console.log("هذا المتصفح لا يدعم إشعارات سطح المكتب");
        const badge = document.getElementById('notification-status-badge');
        if (badge) badge.style.display = 'none';
        return;
    }

    updateNotificationBadgeUI();

    // Auto request on page load since user consented
    if (Notification.permission === 'default') {
        setTimeout(() => {
            Notification.requestPermission().then(() => {
                updateNotificationBadgeUI();
                if (Notification.permission === 'granted') {
                    showLocalNotification("🎉 تم تفعيل الإشعارات بنجاح", "ستتلقى تنبيهات فورية للأقساط المتأخرة وحالة المخزون.");
                }
            });
        }, 2000); // 2 seconds delay for a smoother load experience
    }
}

function updateNotificationBadgeUI() {
    const dot = document.getElementById('notification-status-dot');
    const text = document.getElementById('notification-status-text');
    if (!dot || !text) return;

    if (Notification.permission === 'granted') {
        dot.style.background = 'var(--success)';
        text.innerText = 'الإشعارات نشطة 🔔';
        text.style.color = 'var(--success)';
    } else if (Notification.permission === 'denied') {
        dot.style.background = 'var(--danger)';
        text.innerText = 'الإشعارات محظورة 🔕';
        text.style.color = '#f87171';
    } else {
        dot.style.background = 'var(--warning)';
        text.innerText = 'تفعيل إشعارات النظام 🔔';
        text.style.color = 'var(--warning)';
    }
}

function requestNotificationPermissionManual() {
    if (!("Notification" in window)) return;
    
    Notification.requestPermission().then(() => {
        updateNotificationBadgeUI();
        if (Notification.permission === 'granted') {
            showLocalNotification("🎉 تم التفعيل بنجاح", "تم تفعيل الإشعارات بالكامل لشركة هايبرد إينرجي!");
        } else if (Notification.permission === 'denied') {
            alert("لقد قمت بحظر الإشعارات مسبقاً. يرجى تفعيلها من إعدادات المتصفح (أيقونة القفل بجانب الرابط) لتتمكن من تلقي التنبيهات.");
        }
    });
}

function showLocalNotification(title, body, tabTarget = 'dashboard') {
    if (!("Notification" in window) || Notification.permission !== 'granted') return;

    const options = {
        body: body,
        icon: '/static/uploads/' + (window.currentCompanyLogo || ''),
        badge: '/favicon.ico',
        dir: 'rtl',
        silent: false
    };

    try {
        const n = new Notification(title, options);
        n.onclick = function(e) {
            e.preventDefault();
            window.focus();
            
            // Navigate to appropriate tab if sidebar navigation exists
            const tabBtn = document.querySelector(`.sidebar-menu .menu-item[data-tab="${tabTarget}"]`);
            if (tabBtn) tabBtn.click();
        };
    } catch (e) {
        console.error("Failed to trigger Notification API:", e);
    }
}

async function checkAndTriggerSystemNotifications(stats) {
    if (Notification.permission !== 'granted') return;

    // 1. Overdue Installments Notification
    if (stats.overdue_installments && stats.overdue_installments.length > 0) {
        const hasNotifiedOverdue = sessionStorage.getItem('notified_overdue_inst');
        if (!hasNotifiedOverdue) {
            const count = stats.overdue_installments.length;
            showLocalNotification(
                "⚠️ أقساط متأخرة مستحقة الدفع",
                `يوجد (${count}) أقساط متجاوزة لتاريخ الاستحقاق ومستحقة الدفع فوراً!`,
                'dashboard'
            );
            sessionStorage.setItem('notified_overdue_inst', 'true');
        }
    }

    // 2. Low Warehouse Stock Notification
    try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
            const items = await res.json();
            const lowStockItems = items.filter(item => item.quantity_on_hand <= 5);
            if (lowStockItems.length > 0) {
                const hasNotifiedStock = sessionStorage.getItem('notified_low_stock_items');
                if (!hasNotifiedStock) {
                    const names = lowStockItems.map(i => i.item_name).join('، ');
                    showLocalNotification(
                        "📦 تنبيه المخزن البسيط",
                        `القطع التالية أوشكت على النفاد (الكمية 5 أو أقل): ${names}`,
                        'inventory'
                    );
                    sessionStorage.setItem('notified_low_stock_items', 'true');
                }
            }
        }
    } catch (e) {
        console.error("Error checking inventory stock in notifications", e);
    }
}

// ----------------- STANDALONE CUSTOMER FINANCIALS MODAL & INSTALLMENTS -----------------
async function openStandaloneFinancialsModal(event, customerId) {
    if (event) event.stopPropagation();
    currentFinancialsCustomerId = customerId;
    openModal('modalStandaloneFinancials');
    try {
        const res = await fetch(`/api/customers/${customerId}`);
        if (!res.ok) return;
        const cust = await res.json();
        document.getElementById('financials-modal-title').innerHTML = `💰 الحسابات وجدول الأقساط للعميل: <span style="color: var(--neon-blue);">${cust.name}</span> (${cust.id})`;
        if (cust.financials) {
            document.getElementById('fin-total-modal').value = cust.financials.total_price;
            document.getElementById('fin-downpayment-modal').value = cust.financials.down_payment;
            document.getElementById('fin-installments-modal').value = cust.financials.total_installments;
        } else {
            document.getElementById('fin-total-modal').value = '';
            document.getElementById('fin-downpayment-modal').value = 0;
            document.getElementById('fin-installments-modal').value = 0;
        }
        const genSec = document.getElementById('installment-generator-section-modal');
        genSec.style.display = (cust.sale_type === 'Installment') ? 'block' : 'none';
        renderStandaloneInstallments(cust.installments, cust.name, cust.phone);
    } catch (err) { console.error(err); }
}

function renderStandaloneInstallments(installments, customerName, customerPhone) {
    const tbody = document.getElementById('customer-installments-list-modal');
    tbody.innerHTML = '';
    if (!installments || installments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 15px; color: var(--text-muted);">لا توجد أقساط مسجلة. يرجى توليد الخطة المالية.</td></tr>`;
        return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    installments.forEach(inst => {
        let statusBadge = '';
        if (inst.status === 'Paid') {
            statusBadge = '<span class="badge success">تم السداد 🟢</span>';
        } else if (inst.status === 'Overdue' || inst.due_date < todayStr) {
            statusBadge = '<span class="badge danger">متأخر ⚠️</span>';
        } else if (inst.due_date.slice(0,7) === todayStr.slice(0,7)) {
            statusBadge = '<span class="badge warning">مستحق 🔴</span>';
        } else {
            statusBadge = '<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.1);">قادم 🗓️</span>';
        }
        const payBtn = inst.status === 'Paid'
            ? `<button class="btn btn-success" onclick="printReceiptA4(${inst.id})" style="padding: 4px 8px; font-size: 0.75rem;">🖨️ طباعة الوصل</button>`
            : `<button class="btn btn-primary" onclick="payCustomerInstallmentModal(${inst.id})" style="padding: 4px 8px; font-size: 0.75rem; background: var(--success); border:none;">💰 تسجيل السداد</button>`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold;">قسط ${inst.installment_number}</td>
            <td style="color: var(--neon-blue); font-weight: bold;">${formatCurrency(inst.amount)}</td>
            <td style="font-weight: bold; color: #fff;">${inst.due_date}</td>
            <td>${statusBadge}</td>
            <td>${inst.paid_date || '—'}</td>
            <td><button class="btn btn-secondary" onclick="openEditInstallmentModal(${inst.id}, ${inst.amount}, '${inst.due_date}')" style="padding: 4px 8px; font-size: 0.75rem;">✏️</button></td>
            <td><div style="display: flex; gap: 5px;">${payBtn}<a class="btn btn-secondary" href="${generateWhatsAppReminderLink(customerName, customerPhone, inst.amount, inst.due_date, inst.installment_number)}" target="_blank" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(37,211,102,0.15); color:#25d366;">💬 تذكير</a></div></td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveCustomerFinancialPlanModal() {
    const total = parseFloat(document.getElementById('fin-total-modal').value);
    const down = parseFloat(document.getElementById('fin-downpayment-modal').value);
    const insts = parseInt(document.getElementById('fin-installments-modal').value);
    if (isNaN(total) || isNaN(down) || isNaN(insts)) {
        alert('يرجى تعبئة المبالغ والأشهر كقيم عددية صحيحة!');
        return;
    }
    try {
        const res = await fetch(`/api/customers/${currentFinancialsCustomerId}/financials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ total_price: total, down_payment: down, total_installments: insts })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            if (currentCustomerId === currentFinancialsCustomerId) loadProfileData();
            else openStandaloneFinancialsModal(null, currentFinancialsCustomerId);
            loadCustomers(); loadDashboardStats();
        } else alert(data.error);
    } catch (e) { alert('حدث خطأ في الشبكة'); }
}

async function generateCustomerInstallmentsModal() {
    const startDate = document.getElementById('inst-start-date-modal').value;
    if (!startDate) {
        alert('يرجى تحديد تاريخ استحقاق أول قسط شهري لجدولة المبالغ!');
        return;
    }
    try {
        const res = await fetch(`/api/customers/${currentFinancialsCustomerId}/generate-installments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: startDate })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            if (currentCustomerId === currentFinancialsCustomerId) loadProfileData();
            else openStandaloneFinancialsModal(null, currentFinancialsCustomerId);
            loadCustomers(); loadDashboardStats();
        } else alert(data.error);
    } catch (e) { alert('حدث خطأ أثناء توليد الأقساط'); }
}

async function payCustomerInstallmentModal(instId) {
    if (!confirm('هل تريد تسجيل استلام دفعة هذا القسط وتوليد وصل مالي له؟')) return;
    try {
        const res = await fetch(`/api/installments/${instId}/pay`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            if (currentCustomerId === currentFinancialsCustomerId) loadProfileData();
            else openStandaloneFinancialsModal(null, currentFinancialsCustomerId);
            loadCustomers(); loadDashboardStats();
            printReceiptA4(instId);
        } else alert(data.error);
    } catch (e) { alert('حدث خطأ أثناء السداد'); }
}

// ----------------- CUSTOMER MULTIPLE FILES & FIELD VIDEO VAULT ACTIONS -----------------
async function uploadCustomerVaultFiles() {
    const fileInput = document.getElementById('vault-file-input');
    if (fileInput.files.length === 0) return;
    const files = Array.from(fileInput.files);
    fileInput.value = '';
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 16 * 1024 * 1024) {
            alert(`الملف "${file.name}" يتجاوز الحد الأقصى المسموح به (16 ميغابايت).`);
            continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`/api/customers/${currentCustomerId}/upload`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) {
                const data = await res.json();
                alert(`فشل رفع "${file.name}": ${data.error}`);
            }
        } catch (e) { alert(`خطأ شبكة أثناء رفع "${file.name}"`); }
    }
    loadProfileData();
}

async function uploadCustomerVideoFile() {
    const fileInput = document.getElementById('vault-video-input');
    if (fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    fileInput.value = '';
    if (file.size > 25 * 1024 * 1024) {
        alert('حجم الفيديو يتجاوز 25 ميغابايت! يرجى اختيار ملف أصغر.');
        return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = async function() {
        URL.revokeObjectURL(video.src);
        if (video.duration > 30.5) {
            alert(`مدة الفيديو تبلغ (${Math.round(video.duration)} ثانية)، وهو ما يتجاوز الحد الأقصى (30 ثانية). يرجى تقصير مقطع الفيديو الميداني ثم رفعه.`);
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`/api/customers/${currentCustomerId}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                alert('تم رفع الفيديو التوثيقي بنجاح!');
                loadProfileData();
            } else alert(data.error);
        } catch (e) { alert('حدث خطأ أثناء رفع الفيديو'); }
    };
    video.onerror = function() { alert('فشل قراءة ملف الفيديو. يرجى التأكد من الصيغة.'); };
}

// ----------------- DOWN PAYMENT RECEIPT PRINTING A4 -----------------
async function printFirstReceiptA4() {
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/compile-docs`);
        if (!res.ok) return;
        const data = await res.json();
        const { headerHtml, footerHtml } = compilePrintHeaderAndFooter(data.print_header_template, data.print_footer_template, data.company_info, 'receipt');
        const printArea = document.getElementById('print-area-container');
        printArea.innerHTML = `
            <div class="print-sheet-a4" style="min-height: 150mm; border: 2px solid #000; padding: 15mm; margin-top: 20px;">
                ${headerHtml}
                <h1 class="print-title">وصل قبض مالي (الدفعة المقدمة)</h1>
                <table class="print-table" style="margin-top: 30px; margin-bottom: 30px;">
                    <tr>
                        <td style="width: 25%; background: #f2f2f2; font-weight:bold;">رقم المعاملة/العميل:</td>
                        <td style="width: 25%;">${data.customer_id}</td>
                        <td style="width: 25%; background: #f2f2f2; font-weight:bold;">تاريخ القبض والتشغيل:</td>
                        <td style="width: 25%;">${data.financials.installation_date || '-'}</td>
                    </tr>
                    <tr>
                        <td style="background: #f2f2f2; font-weight:bold;">استلمنا من السيد/السيدة:</td>
                        <td colspan="3" style="font-weight:bold; font-size: 1.1rem; color: #000;">${data.customer_name}</td>
                    </tr>
                    <tr>
                        <td style="background: #f2f2f2; font-weight:bold;">مبلغ الدفعة المقبوضة:</td>
                        <td colspan="3" style="font-weight:bold; font-size: 1.2rem; color: green; background: rgba(16, 185, 129, 0.05);">${formatCurrency(data.financials.down_payment)}</td>
                    </tr>
                    <tr>
                        <td style="background: #f2f2f2; font-weight:bold;">سعر الاتفاق الكلي:</td>
                        <td style="font-weight:bold;">${formatCurrency(data.financials.total_price)}</td>
                        <td style="background: #f2f2f2; font-weight:bold;">المتبقي بذمة العميل:</td>
                        <td style="font-weight:bold; color: red;">${formatCurrency(data.financials.remaining_balance)}</td>
                    </tr>
                    <tr>
                        <td style="background: #f2f2f2; font-weight:bold;">طريقة بيع المنظومة:</td>
                        <td>${data.sale_type === 'Installment' ? 'أقساط شهرية' : 'نقد كاش كامل'}</td>
                        <td style="background: #f2f2f2; font-weight:bold;">أشهر/خطة السداد:</td>
                        <td>${data.sale_type === 'Installment' ? `${data.financials.total_installments} أقساط شهرية` : '—'}</td>
                    </tr>
                </table>
                <div style="font-size: 0.95rem; line-height: 1.8; margin-bottom: 50px; background: rgba(0,0,0,0.01); padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                    <strong>تفاصيل وملاحظات الوصل:</strong><br>
                    تم قبض مبلغ الدفعة الأولى المقدمة المتفق عليها كدفعة تشغيل وتجهيز للمواد المذكورة في العقد الموقع بين الطرفين. يعتبر هذا الوصل إقراراً رسمياً باستلام المبلغ أعلاه.
                </div>
                <div class="print-signatures" style="margin-top: 40px;">
                    <div class="print-signature-box" style="border:none;">المستلم / أمين الصندوق: ________________</div>
                    <div class="print-signature-box" style="border:none;">توقيع العميل المسدد: ________________</div>
                </div>
                ${footerHtml}
            </div>
        `;
        window.print();
    } catch (e) {
        alert('حدث خطأ أثناء طباعة الوصل المالي للدفعة المقدمة');
    }
}

// Global Number Input Formatter
function formatNumberInput(input) {
    let val = input.value.replace(/[^0-9]/g, '');
    if (val) {
        input.value = parseInt(val).toLocaleString('en-US');
    } else {
        input.value = '';
    }
}

function parsePrice(val) {
    if (!val) return 0.0;
    return parseFloat(val.toString().replace(/,/g, '')) || 0.0;
}
