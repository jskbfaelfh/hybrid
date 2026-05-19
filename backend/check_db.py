import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'solar_db.db')
print("DB Path:", db_path)
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

print("=== CUSTOMERS ===")
for r in conn.execute("SELECT * FROM customers").fetchall():
    print(dict(r))

print("\n=== FINANCIAL STATUS ===")
for r in conn.execute("SELECT * FROM financial_status").fetchall():
    print(dict(r))

print("\n=== INSTALLMENTS ===")
for r in conn.execute("SELECT * FROM installments").fetchall():
    print(dict(r))

print("\n=== THE CHART QUERY RESULTS ===")
query = """
SELECT month, SUM(amount) as total
FROM (
    SELECT strftime('%Y-%m', c.installation_date) as month, f.down_payment as amount
    FROM customers c
    JOIN financial_status f ON c.id = f.customer_id
    WHERE f.down_payment > 0
    
    UNION ALL
    
    SELECT strftime('%Y-%m', i.paid_date) as month, i.amount as amount
    FROM installments i
    WHERE i.status = 'Paid' AND i.paid_date IS NOT NULL AND i.paid_date != ''
)
GROUP BY month
ORDER BY month ASC
LIMIT 12
"""
for r in conn.execute(query).fetchall():
    print(dict(r))

conn.close()
