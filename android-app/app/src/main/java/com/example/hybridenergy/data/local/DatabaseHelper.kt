package com.example.hybridenergy.data.local

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

class DatabaseHelper private constructor(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        @Volatile private var instance: DatabaseHelper? = null

        fun getInstance(context: Context): DatabaseHelper {
            return instance ?: synchronized(this) {
                instance ?: DatabaseHelper(context.applicationContext).also { instance = it }
            }
        }

        private const val DATABASE_NAME = "hybrid_energy_offline.db"
        private const val DATABASE_VERSION = 2
        
        // Cache Table (GET requests)
        const val TABLE_CACHE = "api_cache"
        const val COL_CACHE_ENDPOINT = "endpoint"
        const val COL_CACHE_RESPONSE = "response"
        const val COL_CACHE_TIMESTAMP = "timestamp"
        
        // Sync Queue Table (POST/PUT/DELETE requests)
        const val TABLE_SYNC = "sync_queue"
        const val COL_SYNC_ID = "id"
        const val COL_SYNC_ENDPOINT = "endpoint"
        const val COL_SYNC_METHOD = "method"
        const val COL_SYNC_PAYLOAD = "payload"
        const val COL_SYNC_STATUS = "status"
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createCacheTable = """
            CREATE TABLE $TABLE_CACHE (
                $COL_CACHE_ENDPOINT TEXT PRIMARY KEY,
                $COL_CACHE_RESPONSE TEXT NOT NULL,
                $COL_CACHE_TIMESTAMP INTEGER
            )
        """.trimIndent()
        db.execSQL(createCacheTable)

        val createSyncTable = """
            CREATE TABLE $TABLE_SYNC (
                $COL_SYNC_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_SYNC_ENDPOINT TEXT NOT NULL,
                $COL_SYNC_METHOD TEXT NOT NULL,
                $COL_SYNC_PAYLOAD TEXT,
                $COL_SYNC_STATUS TEXT DEFAULT 'pending'
            )
        """.trimIndent()
        db.execSQL(createSyncTable)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS customers") // Drop old specific tables if they exist
        db.execSQL("DROP TABLE IF EXISTS $TABLE_CACHE")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_SYNC")
        onCreate(db)
    }

    // --- GENERIC CACHE METHODS ---
    
    fun saveCache(endpoint: String, responseJson: String) {
        val db = this.writableDatabase
        val values = ContentValues().apply {
            put(COL_CACHE_ENDPOINT, endpoint)
            put(COL_CACHE_RESPONSE, responseJson)
            put(COL_CACHE_TIMESTAMP, System.currentTimeMillis())
        }
        db.insertWithOnConflict(TABLE_CACHE, null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun getCache(endpoint: String): String? {
        val db = this.readableDatabase
        val cursor = db.rawQuery("SELECT $COL_CACHE_RESPONSE FROM $TABLE_CACHE WHERE $COL_CACHE_ENDPOINT = ?", arrayOf(endpoint))
        var result: String? = null
        if (cursor.moveToFirst()) {
            result = cursor.getString(0)
        }
        cursor.close()
        return result
    }

    // --- GENERIC SYNC QUEUE METHODS ---

    fun enqueueSyncTask(endpoint: String, method: String, payload: String): Long {
        val db = this.writableDatabase
        val values = ContentValues().apply {
            put(COL_SYNC_ENDPOINT, endpoint)
            put(COL_SYNC_METHOD, method)
            put(COL_SYNC_PAYLOAD, payload)
            put(COL_SYNC_STATUS, "pending")
        }
        return db.insert(TABLE_SYNC, null, values)
    }

    fun getPendingSyncTasks(): List<Map<String, Any>> {
        val db = this.readableDatabase
        val cursor = db.rawQuery("SELECT * FROM $TABLE_SYNC WHERE $COL_SYNC_STATUS = 'pending' ORDER BY $COL_SYNC_ID ASC", null)
        val tasks = mutableListOf<Map<String, Any>>()
        
        if (cursor.moveToFirst()) {
            do {
                val task = mapOf(
                    "id" to cursor.getLong(cursor.getColumnIndexOrThrow(COL_SYNC_ID)),
                    "endpoint" to cursor.getString(cursor.getColumnIndexOrThrow(COL_SYNC_ENDPOINT)),
                    "method" to cursor.getString(cursor.getColumnIndexOrThrow(COL_SYNC_METHOD)),
                    "payload" to cursor.getString(cursor.getColumnIndexOrThrow(COL_SYNC_PAYLOAD))
                )
                tasks.add(task)
            } while (cursor.moveToNext())
        }
        cursor.close()
        return tasks
    }
    
    fun markTaskAsDone(taskId: Long) {
        val db = this.writableDatabase
        val values = ContentValues().apply {
            put(COL_SYNC_STATUS, "done")
        }
        db.update(TABLE_SYNC, values, "$COL_SYNC_ID = ?", arrayOf(taskId.toString()))
    }
}
