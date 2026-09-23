package com.inchstone.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.util.TypedValue
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * InchstoneWidgetProvider — renders one "page" of the user's widget design on
 * the home screen and rotates through the configured pages.
 *
 * Pages come from /api/widget (designed in the web app's Settings → Widget):
 * kind = plan | timers | alarms | messages | clock | note, each with optional
 * per-page accent/background and per-element text styles.
 *
 * Tap the widget → next page. A repeating alarm advances pages automatically
 * (ACTION_ROTATE) and each tick also refreshes the data.
 */
class InchstoneWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        // Draw from cache instantly, then pull fresh data in the background.
        for (id in ids) render(context, manager, id)
        WidgetData.refreshAsync(context)
    }

    override fun onEnabled(context: Context) { WidgetData.scheduleRotation(context) }
    override fun onDisabled(context: Context) { WidgetData.stopRotation(context) }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val manager = AppWidgetManager.getInstance(context)
        when (intent.action) {
            // Tap → advance this widget one page.
            ACTION_NEXT_PAGE -> {
                val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)
                if (id >= 0) {
                    WidgetData.advancePage(context, id)
                    render(context, manager, id)
                }
            }
            // Rotation tick → advance every widget, then refresh the data so
            // the next tick has current deeds/alarms/messages.
            ACTION_ROTATE -> {
                val ids = manager.getAppWidgetIds(
                    android.content.ComponentName(context, InchstoneWidgetProvider::class.java))
                for (id in ids) {
                    WidgetData.advancePage(context, id)
                    render(context, manager, id)
                }
                WidgetData.refreshAsync(context)
            }
        }
    }

    companion object {
        const val ACTION_NEXT_PAGE = "com.inchstone.widget.NEXT_PAGE"
        const val ACTION_ROTATE = "com.inchstone.widget.ROTATE"
    }
}

/** One render pass: fetch (or reuse) data, draw the current page. */
internal fun render(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
    val views = RemoteViews(context.packageName, R.layout.widget_loading)

    // Default tap action: open the pairing screen. The happy path below
    // replaces this with "next page", so an unpaired widget is still tappable.
    views.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(
        context, appWidgetId,
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

    val secret = WidgetData.secret(context)
    if (secret.isNullOrEmpty()) {
        drawPlaceholder(views, "Tap to pair\nwith Inchstone")
        push(context, manager, appWidgetId, views)
        return
    }

    val json = WidgetData.cachedJson(context)
    if (json == null) {
        // Network on the main thread is not allowed — kick a background
        // refresh and draw the waiting state meanwhile.
        WidgetData.refreshAsync(context)
        drawPlaceholder(views, "Connecting…")
        push(context, manager, appWidgetId, views)
        return
    }

    val pages = WidgetData.pages(json)
    if (pages.isEmpty()) {
        drawPlaceholder(views, "No pages configured")
        push(context, manager, appWidgetId, views)
        return
    }

    val pageIndex = WidgetData.currentPage(context, appWidgetId) % pages.size
    // JSONArray.get() is a Java Object in Kotlin — resolve it as a JSONObject.
    val page = pages.optJSONObject(pageIndex)
    if (page == null) {
        push(context, manager, appWidgetId, views)
        return
    }
    drawPage(context, views, json, page)

    // Tap anywhere → next page
    val tap = Intent(context, InchstoneWidgetProvider::class.java).apply {
        action = InchstoneWidgetProvider.ACTION_NEXT_PAGE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
    }
    views.setOnClickPendingIntent(R.id.root, PendingIntent.getBroadcast(
        context, appWidgetId, tap,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

    push(context, manager, appWidgetId, views)
}

internal fun drawPage(context: Context, views: RemoteViews, json: JSONObject, page: JSONObject) {
    val now = Date()
    views.setTextViewText(R.id.day_label,
        SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(now).uppercase(Locale.getDefault()))
    views.setTextViewText(R.id.clock,
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(now))

    val accent = Color.parseColor(page.optString("accent", "#B8935A"))
    views.setTextColor(R.id.clock, accent)
    views.setInt(R.id.root, "setBackgroundColor", Color.parseColor(page.optString("bg", "#0A0908")))

    when (page.optString("kind", "plan")) {
        "timers" -> drawTimers(views, json, accent)
        "alarms" -> drawAlarms(views, json, accent)
        "messages" -> drawMessages(views, json, accent)
        "clock" -> drawClock(views, accent)
        "note" -> drawNote(views, page)
        else -> drawPlan(views, json, accent)
    }

    // Per-element text styling from the web designer wins over the defaults.
    applyStyles(views, page)
}

/**
 * Applies `page.styles` — the custom look the user chose for individual
 * elements in Settings → Widget. Keys: title, secondary, dayLabel, clock.
 */
private fun applyStyles(views: RemoteViews, page: JSONObject) {
    val styles = page.optJSONObject("styles") ?: return
    val targets = mapOf(
        "title" to R.id.title,
        "secondary" to R.id.secondary,
        "dayLabel" to R.id.day_label,
        "clock" to R.id.clock,
    )
    for ((key, viewId) in targets) {
        val style = styles.optJSONObject(key) ?: continue
        val color = style.optString("color")
        if (color.isNotEmpty()) {
            try { views.setTextColor(viewId, Color.parseColor(color)) } catch (e: Exception) { /* bad value */ }
        }
        if (style.has("size")) {
            val size = style.optDouble("size", 0.0).toFloat()
            if (size >= 8f && size <= 48f) {
                views.setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_SP, size)
            }
        }
    }
}

private fun push(context: Context, manager: AppWidgetManager, id: Int, views: RemoteViews) {
    manager.updateAppWidget(id, views)
}

private fun drawPlaceholder(views: RemoteViews, message: String) {
    views.setTextViewText(R.id.day_label, "INCHSTONE")
    views.setTextViewText(R.id.clock, "")
    views.setTextViewText(R.id.title, message)
    views.setTextViewText(R.id.secondary, "")
    views.setProgressBar(R.id.progress, 100, 0, true)
}