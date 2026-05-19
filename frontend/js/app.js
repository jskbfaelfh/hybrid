/* 
   ==========================================================================
   شمس-تك للطاقة الشمسية | وحدة التحكم والتفاعل البرمجي للواجهات (app.js)
   ==========================================================================
*/

// Global variables and state
let activeTab = 'dashboard';
let currentCustomerId = null;
let selectedBulkCustomers = new Set();
let dashboardChartInstance = null;
let currentCompanyName = 'شمس-تك';

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
    loadSettings(); // Load custom logo and settings at startup!
    
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
            s: `أهلاً بك، مدير النظام. إليك نظرة شاملة على أعمال ${currentCompanyName} اليوم.`
        },
        customers: {
            t: 'إدارة وتتبع العملاء',
            s: 'تسجيل العملاء، مراجعة أنظمة الطاقة الخاصة بهم، متابعة الأقساط الشهرية وطباعة العقود.'
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
    const tabBtns = document.querySelectorAll('#modalCustomerProfile .tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-profile-tab');
            
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#modalCustomerProfile .tab-pane').forEach(p => p.classList.remove('active'));
            
            // Set active
            this.classList.add('active');
            document.getElementById(`profile-tab-${targetTab}`).classList.add('active');
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
        
        // Style Net Profit Trend
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
                    <div style="display:flex; gap: 5px;">
                        <a href="${waLink}" target="_blank" class="btn btn-success" style="padding: 6px 10px; font-size: 0.75rem; background: #25d366; border:none; color:#fff;">🟢 واتساب</a>
                        <button class="btn btn-secondary" onclick="viewCustomerProfile('${inst.customer_id}', 'financial')" style="padding: 6px 10px; font-size: 0.75rem;">👤 ملفه</button>
                    </div>
                `;
                overdueContainer.appendChild(card);
            });
        }
        
        // Render Upcoming Table
        const upcomingTable = document.getElementById('dashboard-upcoming-table');
        upcomingTable.innerHTML = '';
        
        if (stats.upcoming_installments.length === 0) {
            upcomingTable.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 25px;">لا توجد أقساط مستحقة قريباً</td></tr>`;
        } else {
            stats.upcoming_installments.forEach(inst => {
                const tr = document.createElement('tr');
                const waLink = generateWhatsAppReminderLink(inst.customer_name, inst.customer_phone, inst.amount, inst.due_date, inst.installment_number);
                
                tr.innerHTML = `
                    <td style="font-weight: bold;">${inst.customer_id}</td>
                    <td style="font-weight: bold; color: #fff;">${inst.customer_name}</td>
                    <td>${inst.customer_phone}</td>
                    <td>القسط #${inst.installment_number}</td>
                    <td style="color: var(--neon-blue); font-weight: bold;">${formatCurrency(inst.amount)}</td>
                    <td style="color: var(--warning); font-weight: bold;">${inst.due_date}</td>
                    <td>
                        <div style="display:flex; gap: 5px;">
                            <a href="${waLink}" target="_blank" class="btn btn-success" style="padding: 5px 10px; font-size: 0.75rem; background: #25d366; border:none; color:#fff;">🟢 واتساب</a>
                            <button class="btn btn-secondary" onclick="viewCustomerProfile('${inst.customer_id}', 'financial')" style="padding: 5px 10px; font-size: 0.75rem;">💰 جدولة</button>
                        </div>
                    </td>
                `;
                upcomingTable.appendChild(tr);
            });
        }
        
        // Compile and Render Charts
        renderDashboardChart(stats.chart_sales, stats.chart_expenses);
        
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

// Chart.js Visual renderer
function renderDashboardChart(salesData, expensesData) {
    const ctx = document.getElementById('dashboardChart').getContext('2d');
    
    // Group all unique months and sort them
    const monthsSet = new Set();
    salesData.forEach(d => monthsSet.add(d.month));
    expensesData.forEach(d => monthsSet.add(d.month));
    
    const sortedMonths = Array.from(monthsSet).sort();
    
    // Map data
    const salesValues = sortedMonths.map(m => {
        const match = salesData.find(d => d.month === m);
        return match ? match.total : 0;
    });
    
    const expensesValues = sortedMonths.map(m => {
        const match = expensesData.find(d => d.month === m);
        return match ? match.total : 0;
    });
    
    if (dashboardChartInstance) {
        dashboardChartInstance.destroy();
    }
    
    dashboardChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedMonths,
            datasets: [
                {
                    label: 'إجمالي الإيرادات والمبالغ المحصلة',
                    data: salesValues,
                    backgroundColor: 'rgba(0, 242, 254, 0.4)',
                    borderColor: 'rgba(0, 242, 254, 1)',
                    borderWidth: 2,
                    borderRadius: 5
                },
                {
                    label: 'إجمالي المصاريف والنفقات',
                    data: expensesValues,
                    backgroundColor: 'rgba(239, 68, 68, 0.3)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 2,
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#f3f4f6',
                        font: { family: 'Tajawal', size: 11, weight: 'bold' }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#9ca3af', font: { family: 'Tajawal' } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    ticks: { color: '#9ca3af', font: { family: 'Tajawal' } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });
}

// ----------------- CUSTOMER OPERATIONS -----------------
let allCustomers = [];

async function loadCustomers() {
    try {
        const res = await fetch('/api/customers');
        if (!res.ok) return;
        allCustomers = await res.json();
        renderCustomersTable(allCustomers);
        setupCustomerSearch();
    } catch (err) {
        console.error("Error loading customers", err);
    }
}

// Customers Table Renderer
function renderCustomersTable(customers) {
    const tbody = document.getElementById('customers-table-body');
    tbody.innerHTML = '';
    
    if (customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 25px;">لا يوجد عملاء مطابقين للبحث.</td></tr>`;
        return;
    }
    
    customers.forEach(cust => {
        const price = cust.financials ? formatCurrency(cust.financials.total_price) : 'غير محدد';
        const saleTypeBadge = cust.sale_type === 'Installment' 
            ? '<span class="badge warning">تقسيط 📅</span>' 
            : '<span class="badge success">نقد 💵</span>';
            
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold;">${cust.id}</td>
            <td style="font-weight: bold; color: #fff;">${cust.name}</td>
            <td>${cust.phone}</td>
            <td>${cust.installation_date || 'غير محدد'}</td>
            <td>${saleTypeBadge}</td>
            <td style="color: var(--neon-blue); font-weight: bold;">${cust.components_count} قطع</td>
            <td style="font-weight: bold; color: var(--success);">${price}</td>
            <td>
                <div style="display:flex; gap: 5px;">
                    <button class="btn btn-secondary" onclick="viewCustomerProfile('${cust.id}', 'info')" style="padding: 6px 12px; font-size: 0.8rem;">👤 ملف العميل</button>
                    <button class="btn btn-secondary" onclick="viewCustomerProfile('${cust.id}', 'financial')" style="padding: 6px 12px; font-size: 0.8rem; border-color: rgba(0, 242, 254, 0.2);">💰 المالية</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
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

// Add Customer Modal
async function openAddCustomerModal() {
    openModal('modalAddCustomer');
    document.getElementById('addCustId').value = 'جاري التوليد...';
    try {
        const res = await fetch('/api/customers/next-id');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('addCustId').value = data.next_id;
        } else {
            document.getElementById('addCustId').value = 'AUTO';
        }
    } catch (e) {
        document.getElementById('addCustId').value = 'AUTO';
    }
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
            body: JSON.stringify({ 
                id, 
                name, 
                phone, 
                address, 
                installation_date, 
                sale_type, 
                notes
            })
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
            
            await loadCustomers();
            loadDashboardStats();
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
    openModal('modalCustomerProfile');
    
    // Set first active tab inside modal
    const tabBtns = document.querySelectorAll('#modalCustomerProfile .tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-profile-tab') === startTab) {
            btn.classList.add('active');
        }
    });
    
    document.querySelectorAll('#modalCustomerProfile .tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`profile-tab-${startTab}`).classList.add('active');
    
    await loadProfileData();
}

async function loadProfileData() {
    if (!currentCustomerId) return;
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}`);
        if (!res.ok) return;
        const cust = await res.json();
        
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
        
        // 3. Components Tab
        renderProfileComponents(cust.components);
        
        // Fetch dynamic settings lists first
        await fetchSettingsListsForProfile();
        
        // Reset category dropdown to "panel" (Solar panels)
        const catSelect = document.getElementById('comp-category-select');
        if (catSelect) {
            catSelect.value = 'panel';
        }
        
        // Populate brand options for panel category by default
        populateBrandOptions('panel');
        
        // Hide brand custom text field and show select field
        const selectBrand = document.getElementById('comp-brand-select');
        const inputCustom = document.getElementById('comp-brand-custom');
        if (selectBrand) selectBrand.style.display = 'block';
        if (inputCustom) inputCustom.style.display = 'none';
        
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
    
    if (!name || !phone) {
        alert('الاسم ورقم الهاتف مطلوبين!');
        return;
    }
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, address, installation_date, sale_type, notes })
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
function renderProfileComponents(components) {
    const tbody = document.getElementById('customer-components-list');
    tbody.innerHTML = '';
    
    if (components.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 15px; color: var(--text-muted);">لا توجد قطع منصبة مسجلة بعد لهذا العميل.</td></tr>`;
        return;
    }
    
    components.forEach(comp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold; color: #fff;">${comp.component_name}</td>
            <td>${comp.quantity}</td>
            <td>${formatCurrency(comp.unit_price)}</td>
            <td style="color: var(--neon-blue); font-weight: bold;">${formatCurrency(comp.total_price)}</td>
            <td style="color: var(--success); font-weight: bold;">🛡️ ${comp.warranty_period || 'بدون ضمان'}</td>
            <td>
                <button class="btn btn-danger" onclick="deleteCustomerComponent(${comp.id})" style="padding: 4px 8px; font-size: 0.75rem;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

let currentSettingsLists = null;

async function fetchSettingsListsForProfile() {
    try {
        const res = await fetch('/api/settings/lists');
        if (res.ok) {
            currentSettingsLists = await res.json();
        }
    } catch (e) {}
}

function onComponentCategoryChange(selectElement) {
    const category = selectElement.value;
    const selectBrand = document.getElementById('comp-brand-select');
    const inputCustom = document.getElementById('comp-brand-custom');
    
    if (category === 'custom') {
        selectBrand.style.display = 'none';
        inputCustom.style.display = 'block';
        inputCustom.value = '';
        inputCustom.focus();
    } else {
        selectBrand.style.display = 'block';
        inputCustom.style.display = 'none';
        populateBrandOptions(category);
    }
}

function populateBrandOptions(category) {
    const selectBrand = document.getElementById('comp-brand-select');
    if (!selectBrand || !currentSettingsLists) return;
    
    selectBrand.innerHTML = '';
    
    let items = [];
    let placeholder = '';
    
    if (category === 'panel') {
        items = currentSettingsLists.panel_brands || [];
        placeholder = 'اختر نوع اللوح الشمسي...';
    } else if (category === 'inverter') {
        items = currentSettingsLists.inverter_brands || [];
        placeholder = 'اختر جهاز الانفيرتر...';
    } else if (category === 'battery') {
        items = currentSettingsLists.battery_types || [];
        placeholder = 'اختر سعة/نوع البطارية...';
    }
    
    // Add default disabled option
    const optDefault = document.createElement('option');
    optDefault.value = '';
    optDefault.disabled = true;
    optDefault.selected = true;
    optDefault.textContent = placeholder;
    selectBrand.appendChild(optDefault);
    
    items.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.value;
        opt.textContent = i.value;
        selectBrand.appendChild(opt);
    });
}

async function addCustomerComponent() {
    const category = document.getElementById('comp-category-select').value;
    let name = '';
    
    if (category === 'custom') {
        name = document.getElementById('comp-brand-custom').value.trim();
    } else {
        name = document.getElementById('comp-brand-select').value;
    }
    
    const qty = parseInt(document.getElementById('comp-qty').value);
    const unit_price = parseFloat(document.getElementById('comp-price').value);
    const warranty = document.getElementById('comp-warranty').value;
    
    if (!name || name === '' || qty <= 0 || isNaN(unit_price)) {
        alert('يرجى اختيار/كتابة اسم القطعة وتعبئة الكمية والسعر بشكل صحيح!');
        return;
    }
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/components`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ component_name: name, quantity: qty, unit_price, warranty_period: warranty })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('comp-category-select').value = 'panel';
            document.getElementById('comp-brand-custom').value = '';
            document.getElementById('comp-brand-custom').style.display = 'none';
            
            const selectBrand = document.getElementById('comp-brand-select');
            selectBrand.style.display = 'block';
            
            document.getElementById('comp-qty').value = 1;
            document.getElementById('comp-price').value = '';
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
    const down = parseFloat(document.getElementById('fin-downpayment').value);
    const insts = parseInt(document.getElementById('fin-installments').value);
    
    if (isNaN(down) || isNaN(insts)) {
        alert('يرجى تعبئة الدفعة الأولى وعدد أشهر التقسيط كقيم صحيحة!');
        return;
    }
    
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/financials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ down_payment: down, total_installments: insts })
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
    
    installments.forEach(inst => {
        const statusBadge = inst.status === 'Paid' 
            ? '<span class="badge success">مدفوع ✔️</span>' 
            : (inst.status === 'Overdue' ? '<span class="badge danger">متأخر ⚠️</span>' : '<span class="badge warning">مستحق ⏳</span>');
            
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
        const res = await fetch(`/api/installments/${instId}/pay`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        let data;
        try {
            data = await res.json();
        } catch (e) {
            data = { error: 'استجابة غير صالحة من الخادم' };
        }
        
        if (res.ok) {
            alert(data.message || 'تم تسجيل السداد بنجاح');
            loadProfileData();
            loadDashboardStats();
            
            printReceiptA4(instId);
        } else {
            alert(data.error || 'حدث خطأ في معالجة الطلب');
        }
    } catch (e) {
        console.error(e);
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

// ----------------- A4 CUSTOM WYSIWYG PRINTING SYSTEM -----------------
function getPrintHeaderLogoHtml(companyInfo) {
    if (companyInfo && companyInfo.logo) {
        return `<div class="print-header-logo" style="display: flex; align-items: center; gap: 10px;">
            <img src="/static/uploads/${companyInfo.logo}" style="height: 48px; object-fit: contain; border-radius: 4px;">
            <span>${companyInfo.name}</span>
        </div>`;
    } else {
        const name = (companyInfo && companyInfo.name) ? companyInfo.name : currentCompanyName;
        return `<div class="print-header-logo">☀️ ${name}</div>`;
    }
}

function applyCompanyLogo(logoPath) {
    const sidebarPlaceholder = document.getElementById('sidebar-logo-icon');
    const sidebarImg = document.getElementById('sidebar-logo-img');
    const sidebarText = document.getElementById('sidebar-logo-text');
    
    // Dynamically update page title and sidebar text
    if (sidebarText) sidebarText.innerText = currentCompanyName;
    document.title = `${currentCompanyName} | لوحة التحكم`;
    
    // Also update dynamic dashboard header subtitle
    const viewSub = document.getElementById('viewSubtitle');
    if (viewSub && activeTab === 'dashboard') {
        viewSub.innerText = `أهلاً بك، مدير النظام. إليك نظرة شاملة على أعمال ${currentCompanyName} اليوم.`;
    }
    
    const previewPlaceholder = document.getElementById('logo-preview-placeholder');
    const previewImg = document.getElementById('logo-preview-img');
    
    if (logoPath) {
        const fullPath = `/static/uploads/${logoPath}`;
        
        if (sidebarPlaceholder) sidebarPlaceholder.style.display = 'none';
        if (sidebarImg) {
            sidebarImg.src = fullPath;
            sidebarImg.style.display = 'block';
        }
        
        if (previewPlaceholder) previewPlaceholder.style.display = 'none';
        if (previewImg) {
            previewImg.src = fullPath;
            previewImg.style.display = 'block';
        }
    } else {
        if (sidebarPlaceholder) sidebarPlaceholder.style.display = 'block';
        if (sidebarImg) sidebarImg.style.display = 'none';
        
        if (previewPlaceholder) previewPlaceholder.style.display = 'block';
        if (previewImg) previewImg.style.display = 'none';
    }
}

async function uploadCompanyLogo() {
    const fileInput = document.getElementById('sett-logo-file');
    if (!fileInput.files || fileInput.files.length === 0) return;
    
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
            loadSettings();
        } else {
            alert(data.error || 'فشل رفع الشعار');
        }
    } catch (err) {
        alert('حدث خطأ أثناء رفع الشعار');
    }
}

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
        
        window.print();
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
        
        window.print();
    } catch (e) {
        alert('حدث خطأ أثناء توليد شهادة الضمان');
    }
}

async function printHandoverA4() {
    try {
        const res = await fetch(`/api/customers/${currentCustomerId}/compile-docs`);
        if (!res.ok) return;
        const data = await res.json();
        
        const { headerHtml, footerHtml } = compilePrintHeaderAndFooter(data.print_header_template, data.print_footer_template, data.company_info, 'handover');
        
        let totalCostSum = 0;
        let tableRows = '';
        
        data.components.forEach((comp, idx) => {
            totalCostSum += comp.total_price;
            tableRows += `
                <tr>
                    <td style="text-align:center;">${idx+1}</td>
                    <td><strong>${comp.component_name}</strong></td>
                    <td style="text-align:center;">${comp.quantity}</td>
                    <td style="text-align:left;">${formatCurrency(comp.unit_price)}</td>
                    <td style="text-align:left; font-weight:bold;">${formatCurrency(comp.total_price)}</td>
                    <td style="text-align:center; font-weight:bold; color:green;">${comp.warranty_period}</td>
                </tr>
            `;
        });
        
        if (data.components.length === 0) {
            tableRows = `<tr><td colspan="6" style="text-align:center; padding: 20px;">لم يتم تسجيل قطع مجهزة لهذا نظام بعد.</td></tr>`;
        }
        
        const printArea = document.getElementById('print-area-container');
        printArea.innerHTML = `
            <div class="print-sheet-a4">
                ${headerHtml}
                <h1 class="print-title">تقرير تسليم فني ومبيعات نظام طاقة شمسية</h1>
                
                <table class="print-table" style="margin-bottom: 25px;">
                    <tr>
                        <td style="width: 20%; background: #f2f2f2; font-weight:bold;">رقم العميل:</td>
                        <td style="width: 30%;">${data.customer_id}</td>
                        <td style="width: 20%; background: #f2f2f2; font-weight:bold;">اسم العميل:</td>
                        <td style="width: 30%; font-weight:bold;">${data.customer_name}</td>
                    </tr>
                    <tr>
                        <td style="background: #f2f2f2; font-weight:bold;">رقم الهاتف:</td>
                        <td>${data.customer_phone}</td>
                        <td style="background: #f2f2f2; font-weight:bold;">تاريخ التسليم:</td>
                        <td>${data.financials.installation_date || '-'}</td>
                    </tr>
                    <tr>
                        <td style="background: #f2f2f2; font-weight:bold;">طريقة التعاقد:</td>
                        <td>${data.sale_type === 'Installment' ? 'أقساط شهرية' : 'نقد كاش'}</td>
                        <td style="background: #f2f2f2; font-weight:bold;">الدفعة الأولى المقبوضة:</td>
                        <td style="font-weight:bold; color: #0284c7;">${formatCurrency(data.financials.down_payment)}</td>
                    </tr>
                </table>

                <h3 style="margin-bottom: 12px; border-bottom: 1px solid #000; padding-bottom: 5px;">📦 تفاصيل المواد والأجهزة المستلمة وفترات ضمانها:</h3>
                
                <table class="print-table">
                    <thead>
                        <tr>
                            <th style="width: 8%; text-align:center;">ت</th>
                            <th style="width: 40%;">القطعة والمادة المجهزة</th>
                            <th style="width: 10%; text-align:center;">العدد</th>
                            <th style="width: 18%; text-align:left;">سعر المفرد</th>
                            <th style="width: 24%; text-align:left;">السعر الإجمالي</th>
                            <th style="width: 20%; text-align:center;">فترة الضمان</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        <tr style="background:#f2f2f2; font-weight:bold;">
                            <td colspan="4" style="text-align:left;">المجموع المالي الكلي للقطع والتركيب:</td>
                            <td style="text-align:left;">${formatCurrency(totalCostSum)}</td>
                            <td>-</td>
                        </tr>
                    </tbody>
                </table>

                <div class="print-signatures" style="margin-top: 50px;">
                    <div class="print-signature-box">مسؤول فحص الجودة والتسليم للشركة</div>
                    <div class="print-signature-box">توقيع العميل بالاستلام والمعاينة</div>
                </div>
                ${footerHtml}
            </div>
        `;
        
        window.print();
    } catch (e) {
        alert('حدث خطأ أثناء معالجة تقرير تسليم القطع');
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
        
        window.print();
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
            selectedBulkCustomers.add(c.id);
            
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
            
            tr.innerHTML = `
                <td style="font-weight: bold; color: #fff;">${item.item_name}</td>
                <td>${catName}</td>
                <td style="color: var(--neon-blue); font-weight: 800; font-size: 1.1rem;">${item.quantity_on_hand} قطع</td>
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
}

async function submitAddInventory() {
    const item_name = document.getElementById('addInvName').value.trim();
    const item_category = document.getElementById('addInvCategory').value;
    const quantity_on_hand = parseInt(document.getElementById('addInvQty').value);
    const notes = document.getElementById('addInvNotes').value.trim();
    
    if (!item_name || isNaN(quantity_on_hand)) {
        alert('اسم المادة والكمية حقول مطلوبة!');
        return;
    }
    
    try {
        const res = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_name, item_category, quantity_on_hand, notes })
        });
        if (res.ok) {
            closeModal('modalAddInventory');
            document.getElementById('addInvName').value = '';
            document.getElementById('addInvQty').value = '0';
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
            document.getElementById('sett-company-name').value = configs.company_name || '';
            document.getElementById('sett-company-phone').value = configs.company_phone || '';
            document.getElementById('sett-company-address').value = configs.company_address || '';
            document.getElementById('sett-contract-template').value = configs.contract_template || '';
            document.getElementById('sett-warranty-template').value = configs.warranty_template || '';
            document.getElementById('sett-admin-password').value = '';
            
            // Set dynamic sidebar logo and settings preview
            applyCompanyLogo(configs.company_logo);
            
            // Set dynamic print header and footer image previews for all 4 document types
            applyPrintImagePreview('contract_header', configs.print_contract_header_img);
            applyPrintImagePreview('contract_footer', configs.print_contract_footer_img);
            applyPrintImagePreview('warranty_header', configs.print_warranty_header_img);
            applyPrintImagePreview('warranty_footer', configs.print_warranty_footer_img);
            applyPrintImagePreview('handover_header', configs.print_handover_header_img);
            applyPrintImagePreview('handover_footer', configs.print_handover_footer_img);
            applyPrintImagePreview('receipt_header', configs.print_receipt_header_img);
            applyPrintImagePreview('receipt_footer', configs.print_receipt_footer_img);
        }
        
        loadSettingsListCategories();
        
    } catch (e) {}
}

async function saveGeneralSettings() {
    const name = document.getElementById('sett-company-name').value.trim();
    const phone = document.getElementById('sett-company-phone').value.trim();
    const address = document.getElementById('sett-company-address').value.trim();
    const pass = document.getElementById('sett-admin-password').value;
    
    if (!name) {
        alert('اسم الشركة حقل مطلوب!');
        return;
    }
    
    const payload = {
        company_name: name,
        company_phone: phone,
        company_address: address
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
        
        if (id === 'modalCustomerProfile') {
            currentCustomerId = null;
        }
    }
}// ----------------- CLOUDFLARE R2 BACKUP SYSTEMS -----------------
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
