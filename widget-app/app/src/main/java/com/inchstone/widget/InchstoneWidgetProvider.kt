package com.inchstone.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
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
 * kind = plan | alarms | messages | clock | note, each with optional
 * per-page accent/background and per-element styles.
 *
 * Tap the widget → next page. A handler rotates pages automatically.
 */
class InchstoneWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) render(context, manager, id)
    }

    override fun onEnabled(context: Context) { WidgetData.scheduleRotation(context) }
    override fun onDisabled(context: Context) { WidgetData.stopRotation(context) }

    /** Tap on the widget → advance to the next page immediately. */
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_NEXT_PAGE) {
            val manager = AppWidgetManager.getInstance(context)
            val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)
            if (id >= 0) {
                WidgetData.advancePage(context, id)
                render(context, manager, id)
            }
        }
    }

    companion object {
        const val ACTION_NEXT_PAGE = "com.inchstone.widget.NEXT_PAGE"
    }
}

/** One render pass: fetch (or reuse) data, draw the current page. */
internal fun render(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
    val views = RemoteViews(context.packageName, R.layout.widget_loading)

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
    drawPage(context, views, json, pages[pageIndex])

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
        "alarms" -> drawAlarms(views, json, accent)
        "messages" -> drawMessages(views, json, accent)
        "clock" -> drawClock(views, accent)
        "note" -> drawNote(views, page)
        else -> drawPlan(views, json, accent)
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