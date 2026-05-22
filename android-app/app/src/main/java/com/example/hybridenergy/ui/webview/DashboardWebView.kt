package com.example.hybridenergy.ui.webview

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.*
import android.widget.FrameLayout
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import android.content.ContextWrapper
import com.example.hybridenergy.sync.SyncManager

fun Context.findActivity(): Activity? {
    var context = this
    while (context is ContextWrapper) {
        if (context is Activity) {
            return context
        }
        context = context.baseContext
    }
    return null
}

class AndroidBridge(
    private val context: Context,
    private val webView: WebView,
    private val onShowNotification: (String, String) -> Unit,
    private val onResetUrl: () -> Unit
) {
    private val dbHelper = com.example.hybridenergy.data.local.DatabaseHelper.getInstance(context)

    @JavascriptInterface
    fun getServerUrl(): String {
        val prefs = context.getSharedPreferences("HybridEnergyPrefs", Context.MODE_PRIVATE)
        return prefs.getString("server_url", "") ?: ""
    }

    @JavascriptInterface
    fun showNotification(title: String, body: String) {
        onShowNotification(title, body)
    }

    @JavascriptInterface
    fun resetServerUrl() {
        onResetUrl()
    }

    @JavascriptInterface
    fun triggerPrint() {
        webView.post {
            try {
                val activity = context.findActivity() ?: (context as? Activity)
                if (activity != null) {
                    val printManager = activity.getSystemService(Context.PRINT_SERVICE) as? android.print.PrintManager
                    val jobName = "هايبرد إينرجي - طباعة"
                    val printAdapter = webView.createPrintDocumentAdapter(jobName)
                    printManager?.print(
                        jobName,
                        printAdapter,
                        android.print.PrintAttributes.Builder().build()
                    )
                } else {
                    val printManager = context.getSystemService(Context.PRINT_SERVICE) as? android.print.PrintManager
                    val jobName = "هايبرد إينرجي - طباعة"
                    val printAdapter = webView.createPrintDocumentAdapter(jobName)
                    printManager?.print(
                        jobName,
                        printAdapter,
                        android.print.PrintAttributes.Builder().build()
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun cleanUrlPath(url: String): String {
        return url.substringBefore('?')
    }

    private fun mergePendingTasks(cleanUrl: String, cachedJson: String): String {
        try {
            val jsonArray = org.json.JSONArray(cachedJson)
            val pending = dbHelper.getPendingSyncTasks()
            
            // 1. Apply any POST additions
            for (task in pending) {
                val method = task["method"] as String
                val endpoint = task["endpoint"] as String
                val payload = task["payload"] as String
                val taskId = task["id"] as Long
                
                val cleanEndpoint = cleanUrlPath(endpoint)
                
                if (method == "POST" && cleanEndpoint == cleanUrl) {
                    val obj = org.json.JSONObject(payload)
                    obj.put("is_offline_unsynced", true)
                    if (!obj.has("id") || obj.getString("id").isEmpty()) {
                        obj.put("id", -taskId)
                    }
                    jsonArray.put(obj)
                }
            }
            
            // 2. Apply any DELETE removals
            for (task in pending) {
                val method = task["method"] as String
                val endpoint = task["endpoint"] as String
                
                val cleanEndpoint = cleanUrlPath(endpoint)
                if (method == "DELETE" && cleanEndpoint.startsWith("$cleanUrl/")) {
                    val idToDelete = cleanEndpoint.substringAfter("$cleanUrl/")
                    if (idToDelete.isNotEmpty()) {
                        val filteredArray = org.json.JSONArray()
                        for (i in 0 until jsonArray.length()) {
                            val obj = jsonArray.getJSONObject(i)
                            val objId = if (obj.has("id")) obj.get("id").toString() else ""
                            if (objId != idToDelete) {
                                filteredArray.put(obj)
                            }
                        }
                        while (jsonArray.length() > 0) {
                            jsonArray.remove(0)
                        }
                        for (i in 0 until filteredArray.length()) {
                            jsonArray.put(filteredArray.getJSONObject(i))
                        }
                    }
                }
            }
            
            return jsonArray.toString()
        } catch (e: Exception) {
            e.printStackTrace()
            return cachedJson
        }
    }

    @JavascriptInterface
    fun saveCache(url: String, responseJson: String) {
        val cleanUrl = cleanUrlPath(url)
        dbHelper.saveCache(cleanUrl, responseJson)
    }

    @JavascriptInterface
    fun getCacheWithOfflineData(url: String): String {
        val cleanUrl = cleanUrlPath(url)
        val cached = dbHelper.getCache(cleanUrl)
        if (cached != null) {
            return mergePendingTasks(cleanUrl, cached)
        }
        return "404"
    }

    @JavascriptInterface
    fun enqueueSyncTask(url: String, method: String, body: String): String {
        val id = dbHelper.enqueueSyncTask(url, method.uppercase(), body)
        if (id != -1L) {
            try {
                SyncManager(context).triggerOneTimeSync()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return if (id != -1L) "success" else "error"
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun DashboardWebView(
    url: String,
    onResetUrl: () -> Unit,
    onShowNotification: (String, String) -> Unit
) {
    var uploadMessageCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }

    val fileChooserLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val results = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            uploadMessageCallback?.onReceiveValue(results)
        } else {
            uploadMessageCallback?.onReceiveValue(null)
        }
        uploadMessageCallback = null
    }

    val emeraldGreen = Color(0xFF10B981)
    val darkBg = Color(0xFF080C14)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(darkBg)
    ) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        webViewInstance = this
                        
                        layoutParams = FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            FrameLayout.LayoutParams.MATCH_PARENT
                        )

                        // Advanced web settings for interactive app support
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.databaseEnabled = true
                        settings.allowFileAccess = true
                        settings.allowContentAccess = true
                        settings.allowFileAccessFromFileURLs = true
                        settings.allowUniversalAccessFromFileURLs = true
                        settings.loadWithOverviewMode = true
                        settings.useWideViewPort = true
                        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                        settings.cacheMode = WebSettings.LOAD_DEFAULT

                        // Bind system bridge for Javascript Notification Interface
                        addJavascriptInterface(
                            AndroidBridge(context, this, onShowNotification, onResetUrl),
                            "AndroidBridge"
                        )

                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): Boolean {
                                // Keep all web navigation within this WebView container
                                return false
                            }

                            override fun shouldInterceptRequest(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): WebResourceResponse? {
                                val urlStr = request?.url?.toString() ?: return null
                                if (urlStr.startsWith("file:///static/") || urlStr.contains("/static/")) {
                                    val index = urlStr.indexOf("/static/")
                                    if (index != -1) {
                                        val path = urlStr.substring(index + "/static/".length).substringBefore("?")
                                        val assetPath = "www/$path"
                                        val mimeType = when {
                                            assetPath.endsWith(".css") -> "text/css"
                                            assetPath.endsWith(".js") -> "application/javascript"
                                            assetPath.endsWith(".png") -> "image/png"
                                            assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg") -> "image/jpeg"
                                            assetPath.endsWith(".gif") -> "image/gif"
                                            assetPath.endsWith(".svg") -> "image/svg+xml"
                                            assetPath.endsWith(".woff") -> "font/woff"
                                            assetPath.endsWith(".woff2") -> "font/woff2"
                                            assetPath.endsWith(".ttf") -> "font/ttf"
                                            else -> "application/octet-stream"
                                        }
                                        
                                        // 1. Try to load from assets first
                                        try {
                                            val stream = context.assets.open(assetPath)
                                            return WebResourceResponse(mimeType, "UTF-8", stream)
                                        } catch (e: java.io.FileNotFoundException) {
                                            // 2. Not in local assets. Fallback to server!
                                            val prefs = context.getSharedPreferences("HybridEnergyPrefs", Context.MODE_PRIVATE)
                                            val serverUrl = prefs.getString("server_url", "") ?: ""
                                            if (serverUrl.isNotEmpty()) {
                                                try {
                                                    val cleanServer = if (serverUrl.endsWith("/")) serverUrl.substring(0, serverUrl.length - 1) else serverUrl
                                                    val remoteUrl = "$cleanServer/static/$path"
                                                    val url = java.net.URL(remoteUrl)
                                                    val conn = url.openConnection() as java.net.HttpURLConnection
                                                    conn.connectTimeout = 3000
                                                    conn.readTimeout = 5000
                                                    conn.setRequestProperty("X-App-Token", "hybrid_mobile_secret_2026")
                                                    return WebResourceResponse(mimeType, conn.contentEncoding ?: "UTF-8", conn.inputStream)
                                                } catch (ex: Exception) {
                                                    ex.printStackTrace()
                                                }
                                            }
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }
                                    }
                                }
                                return super.shouldInterceptRequest(view, request)
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                
                                val prefs = context.getSharedPreferences("HybridEnergyPrefs", Context.MODE_PRIVATE)
                                val serverUrl = prefs.getString("server_url", "") ?: ""
                                
                                // Auto inject Notification wrapper/shim so web app triggers native Android notifications!
                                val jsShim = """
                                    (function() {
                                        window.SERVER_URL = '${serverUrl}';
                                        
                                        if (!window.Notification) {
                                            window.Notification = function(title, options) {
                                                if (window.AndroidBridge) {
                                                    window.AndroidBridge.showNotification(title, options ? options.body : "");
                                                }
                                            };
                                            window.Notification.permission = "granted";
                                            window.Notification.requestPermission = function() {
                                                return Promise.resolve("granted");
                                            };
                                        }
                                        
                                        window.print = function() {
                                            if (window.AndroidBridge && window.AndroidBridge.triggerPrint) {
                                                window.AndroidBridge.triggerPrint();
                                            }
                                        };
                                    })();
                                """.trimIndent()
                                view?.evaluateJavascript(jsShim, null)
                            }
                        }

                        webChromeClient = object : WebChromeClient() {
                            // Enable file chooser for vault and inventory images
                            override fun onShowFileChooser(
                                webView: WebView?,
                                filePathCallback: ValueCallback<Array<Uri>>?,
                                fileChooserParams: FileChooserParams?
                            ): Boolean {
                                uploadMessageCallback?.onReceiveValue(null)
                                uploadMessageCallback = filePathCallback

                                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                    type = "*/*"
                                    addCategory(Intent.CATEGORY_OPENABLE)
                                }

                                try {
                                    fileChooserLauncher.launch(intent)
                                } catch (e: Exception) {
                                    uploadMessageCallback?.onReceiveValue(null)
                                    uploadMessageCallback = null
                                    return false
                                }
                                return true
                            }
                        }

                        loadUrl(url)
                    }
                },
                update = { webView ->
                    // Keep in sync if url changes externally
                }
            )
        }
    }
