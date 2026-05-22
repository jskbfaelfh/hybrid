// Offline Bridge to intercept fetch calls and route them to Android SQLite without blocking the UI thread
const originalFetch = window.fetch;

window.fetch = async function(...args) {
    const urlStr = typeof args[0] === 'string' ? args[0] : args[0].url;
    const options = args[1] || {};
    
    // Only intercept API calls
    if (urlStr.startsWith('/api/') && window.AndroidBridge) {
        const method = (options.method || 'GET').toUpperCase();
        
        // Normalize URL by removing query parameters before saving/loading from cache
        const cleanUrl = urlStr.split('?')[0];
        
        if (method === 'GET') {
            try {
                // Try real network first (Async, Non-blocking!)
                let fullUrl = urlStr;
                const serverUrl = window.SERVER_URL || (window.AndroidBridge && window.AndroidBridge.getServerUrl ? window.AndroidBridge.getServerUrl() : "");
                if (serverUrl) {
                    const cleanServer = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
                    const cleanPath = urlStr.startsWith('/') ? urlStr : '/' + urlStr;
                    fullUrl = cleanServer + cleanPath;
                }
                
                // We must add the Auth token!
                const newOptions = { ...options };
                newOptions.headers = { ...newOptions.headers, 'X-App-Token': 'hybrid_mobile_secret_2026' };
                
                // Very short timeout for fetch to fail fast if offline
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                newOptions.signal = controller.signal;
                
                const res = await originalFetch(fullUrl, newOptions);
                clearTimeout(timeoutId);
                
                if (res.ok) {
                    const cloned = res.clone();
                    const text = await cloned.text();
                    window.AndroidBridge.saveCache(cleanUrl, text); // Fast SQLite write using clean URL
                    return res;
                } else {
                    throw new Error("Server error");
                }
            } catch (e) {
                // Network failed or offline! Fallback to local cache synchronously.
                console.log('Network failed, falling back to cache for:', cleanUrl);
                const cachedStr = window.AndroidBridge.getCacheWithOfflineData(urlStr);
                if (cachedStr && cachedStr !== '404') {
                    return new Response(cachedStr, { status: 200, headers: {'Content-Type': 'application/json'} });
                } else {
                    return new Response(JSON.stringify({error: 'Not found in offline DB'}), { status: 404 });
                }
            }
        } else {
            // POST, PUT, DELETE
            try {
                // Try real network first (Async, Non-blocking!)
                let fullUrl = urlStr;
                const serverUrl = window.SERVER_URL || (window.AndroidBridge && window.AndroidBridge.getServerUrl ? window.AndroidBridge.getServerUrl() : "");
                if (serverUrl) {
                    const cleanServer = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
                    const cleanPath = urlStr.startsWith('/') ? urlStr : '/' + urlStr;
                    fullUrl = cleanServer + cleanPath;
                }
                
                const newOptions = { ...options };
                newOptions.headers = { ...newOptions.headers, 'X-App-Token': 'hybrid_mobile_secret_2026' };
                
                // 5 seconds timeout for mutations
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                newOptions.signal = controller.signal;
                
                const res = await originalFetch(fullUrl, newOptions);
                clearTimeout(timeoutId);
                
                if (res.ok) {
                    return res;
                } else {
                    throw new Error("Mutation failed on server");
                }
            } catch (e) {
                // Network failed or offline! Fallback to enqueuing locally in SQLite.
                console.log('Mutation failed or offline, enqueuing local task:', urlStr);
                const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body || {});
                const enqueueRes = window.AndroidBridge.enqueueSyncTask(urlStr, method, bodyStr);
                if (enqueueRes === 'success') {
                    return new Response(JSON.stringify({success: true, message: "تم حفظ العملية محلياً وسيتم إرسالها للسيرفر عند توفر الإنترنت"}), { status: 200, headers: {'Content-Type': 'application/json'} });
                } else {
                    return new Response(JSON.stringify({success: false}), { status: 500 });
                }
            }
        }
    }
    
    // Normal fetch (if online or not an API call)
    return originalFetch.apply(this, args);
};
