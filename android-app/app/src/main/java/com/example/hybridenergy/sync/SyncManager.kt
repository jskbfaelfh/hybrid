package com.example.hybridenergy.sync

import android.content.Context
import android.util.Log
import com.example.hybridenergy.data.local.DatabaseHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.Scanner

class SyncManager(private val context: Context) {
    private val dbHelper = DatabaseHelper.getInstance(context)
    private var syncJob: Job? = null
    
    // Core endpoints we want to pre-cache for offline use
    private val endpointsToCache = listOf(
        "/api/dashboard/stats",
        "/api/customers",
        "/api/inventory/items",
        "/api/inventory/logs",
        "/api/expenses",
        "/api/settings/currencies"
    )

    fun startAutoSync() {
        if (syncJob?.isActive == true) return
        
        syncJob = CoroutineScope(Dispatchers.IO).launch {
            while (true) {
                try {
                    val prefs = context.getSharedPreferences("HybridEnergyPrefs", Context.MODE_PRIVATE)
                    val serverUrl = prefs.getString("server_url", "") ?: ""
                    
                    if (serverUrl.isNotEmpty() && isServerReachable(serverUrl)) {
                        pushPendingTasks(serverUrl)
                        pullAndCacheData(serverUrl)
                    }
                } catch (e: Exception) {
                    Log.e("SyncManager", "Sync loop error: ${e.message}")
                }
                delay(30000) // Check every 30 seconds
            }
        }
    }

    fun triggerOneTimeSync() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val prefs = context.getSharedPreferences("HybridEnergyPrefs", Context.MODE_PRIVATE)
                val serverUrl = prefs.getString("server_url", "") ?: ""
                if (serverUrl.isNotEmpty() && isServerReachable(serverUrl)) {
                    pushPendingTasks(serverUrl)
                    pullAndCacheData(serverUrl)
                }
            } catch (e: Exception) {
                Log.e("SyncManager", "One-time sync error: ${e.message}")
            }
        }
    }

    fun stopAutoSync() {
        syncJob?.cancel()
    }

    private fun isServerReachable(baseUrl: String): Boolean {
        return try {
            val finalServerUrl = if (baseUrl.endsWith("/")) baseUrl.dropLast(1) else baseUrl
            val url = URL("$finalServerUrl/api/dashboard/stats")
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 3000
            connection.readTimeout = 3000
            connection.requestMethod = "GET"
            connection.setRequestProperty("X-App-Token", "hybrid_mobile_secret_2026")
            connection.responseCode == 200
        } catch (e: Exception) {
            false
        }
    }

    private fun pushPendingTasks(baseUrl: String) {
        val tasks = dbHelper.getPendingSyncTasks()
        for (task in tasks) {
            try {
                val taskId = task["id"] as Long
                val endpoint = task["endpoint"] as String
                val method = task["method"] as String
                val payload = task["payload"] as String

                val finalServerUrl = if (baseUrl.endsWith("/")) baseUrl.dropLast(1) else baseUrl
                val finalPath = if (endpoint.startsWith("/")) endpoint else "/$endpoint"
                val url = URL("$finalServerUrl$finalPath")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = method
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("X-App-Token", "hybrid_mobile_secret_2026")
                connection.doOutput = true

                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(payload)
                    writer.flush()
                }

                if (connection.responseCode in 200..299) {
                    dbHelper.markTaskAsDone(taskId)
                    Log.d("SyncManager", "Task $taskId pushed successfully")
                } else {
                    Log.e("SyncManager", "Task $taskId failed with code ${connection.responseCode}")
                }
            } catch (e: Exception) {
                Log.e("SyncManager", "Failed to push task: ${e.message}")
                break // Stop pushing if one fails to preserve order
            }
        }
    }

    private fun pullAndCacheData(baseUrl: String) {
        for (endpoint in endpointsToCache) {
            try {
                val finalServerUrl = if (baseUrl.endsWith("/")) baseUrl.dropLast(1) else baseUrl
                val finalPath = if (endpoint.startsWith("/")) endpoint else "/$endpoint"
                val url = URL("$finalServerUrl$finalPath")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.setRequestProperty("X-App-Token", "hybrid_mobile_secret_2026")
                connection.connectTimeout = 5000
                connection.readTimeout = 5000

                if (connection.responseCode == 200) {
                    val scanner = Scanner(connection.inputStream).useDelimiter("\\A")
                    if (scanner.hasNext()) {
                        val responseJson = scanner.next()
                        dbHelper.saveCache(endpoint, responseJson)
                        Log.d("SyncManager", "Cached $endpoint successfully")
                    }
                }
            } catch (e: Exception) {
                Log.e("SyncManager", "Failed to pull $endpoint: ${e.message}")
            }
        }
    }
}
