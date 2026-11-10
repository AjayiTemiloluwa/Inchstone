package com.inchstone.widget

import android.graphics.Color
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Per-page renderers. Shared look: title (large), secondary line, progress. */
internal fun drawPlan(views: RemoteViews, json: JSONObject, accent: Int) {
    val next = json.optJSONObject("plan")?.optJSONObject("next")
    views.setTextViewText(R.id.title, next?.optString("title") ?: "Nothing scheduled")
    val time = next?.optString("time")?.takeIf { it != "null" && it.isNotEmpty() }?.let { WidgetData.fmtTime(it) } ?: ""
    views.setTextViewText(R.id.secondary, time)
    views.setTextColor(R.id.secondary, accent)
    views.setProgressBar(R.id.progress, 100, next?.optInt("progress", 0) ?: 0, false)
}

internal fun drawAlarms(views: RemoteViews, json: JSONObject, accent: Int) {
    val alarms: JSONArray? = json.optJSONArray("alarms")
    if (alarms == null || alarms.length() == 0) {
        views.setTextViewText(R.id.title, "No alarms set")
        views.setTextViewText(R.id.secondary, "")
        views.setProgressBar(R.id.progress, 100, 0, true)
        return
    }
    val first = alarms.optJSONObject(0) ?: return
    views.setTextViewText(R.id.title, WidgetData.fmtAlarm(first.optString("time")))
    views.setTextViewText(R.id.secondary, first.optString("title") + extra(alarms.length()))
    views.setTextColor(R.id.title, accent)
    views.setProgressBar(R.id.progress, 100, 0, true)
}

private fun extra(count: Int): String = if (count > 1) "  +${count - 1} more" else ""

internal fun drawMessages(views: RemoteViews, json: JSONObject, accent: Int) {
    val messages: JSONArray? = json.optJSONArray("messages")
    if (messages == null || messages.length() == 0) {
        views.setTextViewText(R.id.title, "No messages yet")
        views.setTextViewText(R.id.secondary, "")
        views.setProgressBar(R.id.progress, 100, 0, true)
        return
    }
    val first = messages.optJSONObject(0) ?: return
    views.setTextViewText(R.id.title, first.optString("text"))
    views.setTextViewText(R.id.secondary, "— ${first.optString("from")}")
    views.setTextColor(R.id.secondary, accent)
    views.setProgressBar(R.id.progress, 100, 0, true)
}

/** A big live clock (TextClock ticks by itself, so it never shows a stale time) and today's date. */
internal fun drawClock(views: RemoteViews, accent: Int) {
    val now = Date()
    views.setViewVisibility(R.id.title, android.view.View.GONE)
    views.setViewVisibility(R.id.big_clock, android.view.View.VISIBLE)
    views.setTextColor(R.id.big_clock, accent)
    views.setTextViewText(R.id.secondary, SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(now))
    views.setProgressBar(R.id.progress, 100, 0, true)
}

/** Todays's *timed* deeds — the next one big, the rest of the schedule beneath. */
internal fun drawTimers(views: RemoteViews, json: JSONObject, accent: Int) {
    val deeds = json.optJSONObject("plan")?.optJSONArray("deeds")
    val timed = mutableListOf<JSONObject>()
    if (deeds != null) {
        for (i in 0 until deeds.length()) {
            val deed = deeds.optJSONObject(i) ?: continue
            val time = deed.optString("time")
            if (time.isEmpty() || time == "null") continue
            timed.add(deed)
        }
    }

    if (timed.isEmpty()) {
        views.setTextViewText(R.id.title, "No timed deeds today")
        views.setTextViewText(R.id.secondary, "")
        views.setProgressBar(R.id.progress, 100, 0, true)
        return
    }

    val next = timed.first()
    val time = WidgetData.fmtTime(next.optString("time"))
    views.setTextViewText(R.id.title, next.optString("title"))
    val done = timed.count { it.optBoolean("completed") }
    views.setTextViewText(
        R.id.secondary,
        "$time  ·  ${done}/${timed.size} done"
    )
    views.setTextColor(R.id.secondary, accent)
    views.setProgressBar(R.id.progress, 100, json.optJSONObject("plan")?.optInt("dayProgress", 0) ?: 0, false)
}

/** Today's deeds as a checklist: ☐ open, ☑ done, with the time when it has one. Up to 5 lines; the count says what is left. */
internal fun drawTasks(views: RemoteViews, json: JSONObject, accent: Int) {
    val deeds = json.optJSONObject("plan")?.optJSONArray("deeds")
    if (deeds == null || deeds.length() == 0) {
        views.setTextViewText(R.id.title, "No deeds today")
        views.setTextViewText(R.id.secondary, "")
        views.setProgressBar(R.id.progress, 100, 0, true)
        return
    }
    val all = mutableListOf<JSONObject>()
    for (i in 0 until deeds.length()) deeds.optJSONObject(i)?.let { all.add(it) }
    val done = all.count { it.optBoolean("completed") }
    // Open deeds first (they are what you act on), finished ones after.
    val ordered = all.filter { !it.optBoolean("completed") } + all.filter { it.optBoolean("completed") }
    val lines = ordered.take(5).joinToString("\n") { d ->
        val time = d.optString("time").takeIf { it.isNotEmpty() && it != "null" }?.let { WidgetData.fmtTime(it) + "  " } ?: ""
        (if (d.optBoolean("completed")) "☑  " else "☐  ") + time + d.optString("title")
    }
    views.setTextViewText(R.id.title, lines)
    views.setTextViewTextSize(R.id.title, android.util.TypedValue.COMPLEX_UNIT_SP, 13f)
    views.setInt(R.id.title, "setMaxLines", 5)
    val more = all.size - 5
    views.setTextViewText(R.id.secondary, "$done/${all.size} done" + if (more > 0) "  ·  +$more more" else "")
    views.setTextColor(R.id.secondary, accent)
    views.setProgressBar(R.id.progress, 100, json.optJSONObject("plan")?.optInt("dayProgress", 0) ?: 0, false)
}

internal fun drawNote(views: RemoteViews, page: JSONObject) {
    views.setTextViewText(R.id.title, page.optString("note", ""))
    views.setTextViewText(R.id.secondary, "")
    views.setProgressBar(R.id.progress, 100, 0, true)
}