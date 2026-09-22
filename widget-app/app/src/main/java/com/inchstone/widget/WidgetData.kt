package com.inchstone.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

/**
 * WidgetData — pairing secret storage, the /api/widget fetch + cache, and the
 * page-rotation scheduler.
 *
 * The secret is entered once in MainActivity (copied from the web app's
 * Settings → Widget) and stored in SharedPreferences. Widget JSON is cached
 * so the widget renders instantly even with no network.
 */
object WidgetData {
    private const val PREFS = "inchstone_widget"
    private const val KEY_SECRET = "secret"
    private const val KEY_HOST = "host"
    private const val KEY_CACHE = "cache"
    private const val KEY_PAGE_PREFIX = "page_"
    private val executor = Executors.newSingleThreadExecutor()

    // ── Pairing secret ──
    fun secret(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SECRET, null)

    fun saveSecret(context: Context, secret: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_SECRET, secret.trim()).apply()
    }

    // ── Server host (e.g. "inchstone.vercel.app") ──
    fun host(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_HOST, "inchstone.vercel.app") ?: "inchstone.vercel.app"

    fun saveHost(context: Context, host: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_HOST, host.trim().removePrefix("https://").removePrefix("http://").trimEnd('/')).apply()
    }

    // ── Cached widget JSON ──
    fun cachedJson(context: Context): JSONObject? {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CACHE, null) ?: return null
        return try { JSONObject(raw) } catch (e: Exception) { null }
    }

    fun refreshAsync(context: Context, onDone: (() -> Unit)? = null) {
        executor.execute {
            val secret = secret(context) ?: return@execute
            try {
                val conn = URL("https://${host(context)}/api/widget?secret=$secret").openConnection() as HttpURLConnection
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().readText()
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit().putString(KEY_CACHE, body).apply()
                    redrawAll(context)
                }
            } catch (e: Exception) { /* offline — cache stays */ }
            onDone?.invoke()
        }
    }

    private fun redrawAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, InchstoneWidgetProvider::class.java))
        for (id in ids) render(context, manager, id)
    }

    // ── Page rotation state ──
    fun currentPage(context: Context, appWidgetId: Int): Int =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_PAGE_PREFIX + appWidgetId, 0)

    fun advancePage(context: Context, appWidgetId: Int) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putInt(KEY_PAGE_PREFIX + appWidgetId, currentPage(context, appWidgetId) + 1).apply()
    }

    fun pages(json: JSONObject): JSONArray = json.optJSONObject("widget")?.optJSONArray("pages") ?: JSONArray()

    // ── Rotation scheduler: tick every configured interval while enabled ──
    fun scheduleRotation(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = rotationPending(context)
        val interval = 60_000L * 2 // ≥ every 2 min; per-page dwell is tracked client-side
        am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME, System.currentTimeMillis() + interval, interval, pi)
    }

    fun stopRotation(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(rotationPending(context))
    }

    private fun rotationPending(context: Context): PendingIntent {
        val intent = Intent(context, InchstoneWidgetProvider::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        }
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    // ── Formatting helpers ──
    fun fmtTime(iso: String): String = try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(parser.parse(iso)!!)
    } catch (e: Exception) { "" }

    fun fmtAlarm(hhmm: String): String = hhmm
}