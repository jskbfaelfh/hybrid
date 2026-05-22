package com.example.hybridenergy.ui.offline

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices

@Composable
fun AddCustomerOfflineScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var gpsLocation by remember { mutableStateOf<String?>(null) }
    
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            fetchLocation(context, fusedLocationClient) { loc -> gpsLocation = loc }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("إضافة عميل جديد (بدون إنترنت)", style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(16.dp))
        
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("اسم العميل") },
            modifier = Modifier.fillMaxWidth()
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        OutlinedTextField(
            value = phone,
            onValueChange = { phone = it },
            label = { Text("رقم الهاتف") },
            modifier = Modifier.fillMaxWidth()
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(
            onClick = {
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    fetchLocation(context, fusedLocationClient) { loc -> gpsLocation = loc }
                } else {
                    permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("التقاط الموقع الجغرافي (GPS) 📍")
        }
        
        if (gpsLocation != null) {
            Text("تم التقاط الموقع: $gpsLocation", color = MaterialTheme.colorScheme.primary)
        }
        
        Spacer(modifier = Modifier.weight(1f))
        
        Button(
            onClick = {
                // TODO: Save to Room DB locally
                onBack()
            },
            modifier = Modifier.fillMaxWidth().height(50.dp)
        ) {
            Text("حفظ البيانات في الموبايل 💾")
        }
        
        Spacer(modifier = Modifier.height(8.dp))
        TextButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
            Text("إلغاء والعودة")
        }
    }
}

private fun fetchLocation(
    context: Context,
    fusedLocationClient: com.google.android.gms.location.FusedLocationProviderClient,
    onResult: (String) -> Unit
) {
    try {
        fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
            if (location != null) {
                onResult("${location.latitude},${location.longitude}")
            } else {
                onResult("تعذر تحديد الموقع")
            }
        }
    } catch (e: SecurityException) {
        onResult("لا يوجد إذن للموقع")
    }
}
