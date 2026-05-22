package com.example.hybridenergy.ui.offline

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun OfflineDashboardScreen(
    onSyncClicked: () -> Unit,
    onBackToWebClicked: () -> Unit
) {
    var showAddCustomer by remember { mutableStateOf(false) }

    if (showAddCustomer) {
        AddCustomerOfflineScreen(onBack = { showAddCustomer = false })
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("العمل الميداني (وضع عدم الاتصال)", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(32.dp))
        
        Button(
            onClick = { showAddCustomer = true },
            modifier = Modifier.fillMaxWidth().height(50.dp)
        ) {
            Text("إضافة عميل جديد (مع GPS)")
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(
            onClick = { /* View Cached Customers */ },
            modifier = Modifier.fillMaxWidth().height(50.dp)
        ) {
            Text("عرض العملاء والمنظومات")
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(
            onClick = onSyncClicked,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
        ) {
            Text("مزامنة البيانات الآن (يتطلب انترنت)")
        }

        Spacer(modifier = Modifier.height(32.dp))
        
        TextButton(
            onClick = onBackToWebClicked,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("العودة للنظام المباشر (أونلاين)")
        }
    }
}
