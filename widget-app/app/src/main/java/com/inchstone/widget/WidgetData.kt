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
    /** Production server — the pairing screen lets the user override it. */
    const val DEFAULT_HOST = "inchstone.vercel.app"

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
            .getString(KEY_HOST, DEFAULT_HOST) ?: DEFAULT_HOST

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
            try {
                val activeSecret = secret(context)
                if (activeSecret.isNullOrEmpty()) return@execute
                val conn = URL("https://${host(context)}/api/widget?secret=$activeSecret").openConnection() as HttpURLConnection
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().readText()
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit().putString(KEY_CACHE, body).apply()
                    rescheduleRotation(context)
                    redrawAll(context)
                }
            } catch (e: Exception) {
                // Offline — keep the last good cache so the widget still draws.
            } finally {
                // Always release the caller (the pairing screen waits on this).
                onDone?.invoke()
            }
        }
    }

    /** Seconds the user chose for per-page dwell (5–120, from the web design). */
    fun rotateSeconds(context: Context): Long {
        val raw = cachedJson(context)?.optJSONObject("widget")?.optInt("rotateSeconds", 15) ?: 15
        return raw.coerceIn(5, 120).toLong()
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

    // ── Rotation scheduler: advance a page every `rotateSeconds` while enabled ──
    //  Android clamps inexact repeating alarms to a 60s floor, so a short
    //  dwell still advances on each tick (and the tap handler advances
    //  instantly for a manual flip).
    fun scheduleRotation(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = rotationPending(context)
        val interval = maxOf(60_000L, rotateSeconds(context) * 1000L)
        am.setInexactRepeating(
            AlarmManager.ELAPSED_REALTIME,
            System.currentTimeMillis() + interval,
            interval,
            pi
        )
    }

    /** Re-arm after the user changes the dwell time in the web design. */
    fun rescheduleRotation(context: Context) {
        val hasWidgets = AppWidgetManager.getInstance(context)
            .getAppWidgetIds(ComponentName(context, InchstoneWidgetProvider::class.java))
            .isNotEmpty()
        if (!hasWidgets) return
        stopRotation(context)
        scheduleRotation(context)
    }

    fun stopRotation(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(rotationPending(context))
    }

    /** Fires InchstoneWidgetProvider.ACTION_ROTATE (advance every widget). */
    private fun rotationPending(context: Context): PendingIntent {
        val intent = Intent(context, InchstoneWidgetProvider::class.java).apply {
            action = InchstoneWidgetProvider.ACTION_ROTATE
        }
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    // ── Formatting helpers ──
    // Prisma emits ISO-8601 with millis + Z ("2026-09-21T10:00:00.000Z").
    // OffsetDateTime parses that natively; convert to the device's zone.
    fun fmtTime(iso: String): String = try {
        val local = java.time.OffsetDateTime.parse(iso).atZoneSameInstant(java.time.ZoneId.systemDefault())
        "%02d:%02d".format(local.hour, local.minute)
    } catch (e: Exception) {
        try { iso.substringAfter('T').take(5) } catch (e2: Exception) { "" }
    }

    fun fmtAlarm(hhmm: String): String = hhmm
}