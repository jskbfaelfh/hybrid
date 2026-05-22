package com.example.hybridenergy

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.app.NotificationCompat
import com.example.hybridenergy.theme.HybridEnergyTheme
import com.example.hybridenergy.ui.config.HostConfigScreen
import com.example.hybridenergy.ui.webview.DashboardWebView

import com.example.hybridenergy.sync.SyncManager

class MainActivity : ComponentActivity() {

    private lateinit var sharedPreferences: SharedPreferences
    private lateinit var syncManager: SyncManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        sharedPreferences = getSharedPreferences("HybridEnergyPrefs", Context.MODE_PRIVATE)
        createNotificationChannel()
        
        syncManager = SyncManager(this)
        syncManager.startAutoSync()

        enableEdgeToEdge()
        setContent {
            HybridEnergyTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    var serverUrl by remember { 
                        mutableStateOf(sharedPreferences.getString("server_url", "") ?: "") 
                    }

                    var hasNotificationPermission by remember { mutableStateOf(false) }

                    val permissionLauncher = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.RequestPermission()
                    ) { isGranted ->
                        hasNotificationPermission = isGranted
                    }

                    LaunchedEffect(Unit) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            hasNotificationPermission = true
                        }
                    }

                    if (serverUrl.isEmpty()) {
                        HostConfigScreen(
                            currentUrl = serverUrl,
                            onSaveUrl = { newUrl ->
                                sharedPreferences.edit().putString("server_url", newUrl).apply()
                                serverUrl = newUrl
                                Toast.makeText(this@MainActivity, "تم ربط التطبيق بالسيرفر بنجاح!", Toast.LENGTH_SHORT).show()
                                
                                // Restart the sync manager with new URL
                                syncManager.stopAutoSync()
                                syncManager.startAutoSync()
                            }
                        )
                    } else {
                        // Always load the Local Offline App Copy
                        DashboardWebView(
                            url = "file:///android_asset/www/index.html",
                            onResetUrl = {
                                sharedPreferences.edit().putString("server_url", "").apply()
                                serverUrl = ""
                            },
                            onShowNotification = { title, body ->
                                showNotification(title, body)
                            }
                        )
                    }
                }
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "تنبيهات هايبرد إينرجي"
            val descriptionText = "تنبيهات الأقساط الشهرية المتأخرة ونفاد كمية المخزون"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel("HYBRID_ENERGY_NOTIF", name, importance).apply {
                description = descriptionText
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun showNotification(title: String, body: String) {
        val builder = NotificationCompat.Builder(this, "HYBRID_ENERGY_NOTIF")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
    }
}
