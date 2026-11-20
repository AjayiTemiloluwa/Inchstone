package com.inchstone.widget

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.TimeZone
import java.util.concurrent.Executors

/**
 * Live — Inchstone's notifications, delivered by the PHONE, with the web app closed.
 *
 *  · One always-on card in the notification bar ("Live status"): the deed you're on (or the next
 *    one) with a countdown Android ticks by itself — no re-posting, no buzzing — plus every deed
 *    of today with its status (✓ done · ▶ running · ○ to do · ✗ missed) and Done / +15 min buttons.
 *    On Android 16 it asks to be promoted to a Live Update (a chip in the status bar).
 *  · Exact alarms set on the phone itself for each moment the server lists: a deed starting (one
 *    buzz), a very-important reminder, an alarm, an application deadline (these ring loud).
 *  · Sync: every ~15 min, after a restart, when the clock/time zone changes and after Done/+15.
 *    The schedule covers 36 h ahead, so a phone that is offline for a while still rings on time.
 *
 * Server side: GET /api/widget?schedule=1 and POST /api/widget?task=…&op=done|extend
 * (src/lib/phoneSchedule.ts). While this phone syncs, the server stops sending web-push copies.
 */
object Live {
    const val CH_LIVE = "live_status"
    const val CH_DEEDS = "deed_starts"
    const val CH_ALARMS = "alarms_deadlines"

    const val ACTION_ALERT = "com.inchstone.widget.ALERT"
    const val ACTION_CARD = "com.inchstone.widget.CARD"
    const val ACTION_SYNC = "com.inchstone.widget.SYNC"
    const val ACTION_DONE = "com.inchstone.widget.DONE"
    const val ACTION_EXTEND = "com.inchstone.widget.EXTEND"

    private const val PREFS = "inchstone_live"
    private const val KEY_SCHEDULE = "schedule"
    private const val KEY_ARMED = "armed"
    private const val KEY_FIRED = "fired"
    private const val CARD_ID = 4201
    private const val SYNC_EVERY_MS = 15 * 60_000L
    private val executor = Executors.newSingleThreadExecutor()

    // ── Channels (Android 8+). The live card is LOW: in the bar, never a sound or pop-up. ──
    fun ensureChannels(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH_LIVE, "Live status (today's deeds)", NotificationManager.IMPORTANCE_LOW).apply {
            description = "One quiet card that always shows your current deed and today's progress."
            setShowBadge(false)
        })
        nm.createNotificationChannel(NotificationChannel(CH_DEEDS, "Deed starting", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "One buzz when a deed starts."
        })
        nm.createNotificationChannel(NotificationChannel(CH_ALARMS, "Alarms & deadlines", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Your alarms, very-important deed reminders and application deadlines."
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
            )
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 200, 400)
        })
    }

    fun canNotify(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
    private fun ms(iso: String?): Long? = try { if (iso.isNullOrEmpty()) null else OffsetDateTime.parse(iso).toInstant().toEpochMilli() } catch (e: Exception) { null }
    private fun hhmm(at: Long): String { val t = Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()); return "%02d:%02d".format(t.hour, t.minute) }
    private fun isToday(at: Long) = Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).toLocalDate() == LocalDate.now()

    // ── Sync: download the schedule, arm the alarms, redraw the card. Offline → use the last copy. ──
    fun syncAsync(ctx: Context, then: (() -> Unit)? = null) {
        val app = ctx.applicationContext
        executor.execute {
            try { sync(app) } catch (e: Exception) { /* keep the last good schedule */ } finally { then?.invoke() }
        }
    }

    private fun sync(ctx: Context) {
        ensureChannels(ctx)
        var json: JSONObject? = null
        val secret = WidgetData.secret(ctx)
        if (!secret.isNullOrEmpty()) {
            try {
                val q = "secret=${enc(secret)}&tz=${enc(TimeZone.getDefault().id)}&v=${enc(WidgetData.APP_VERSION)}&schedule=1"
                val conn = URL("https://${WidgetData.host(ctx)}/api/widget?$q").openConnection() as HttpURLConnection
                conn.connectTimeout = 8_000
                conn.readTimeout = 8_000
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().readText()
                    json = JSONObject(body)
                    prefs(ctx).edit().putString(KEY_SCHEDULE, body).apply()
                }
            } catch (e: Exception) { /* offline */ }
        }
        if (json == null) json = cached(ctx)
        if (json != null) arm(ctx, json)
        armSync(ctx)
        showCard(ctx)
    }

    private fun cached(ctx: Context): JSONObject? =
        prefs(ctx).getString(KEY_SCHEDULE, null)?.let { try { JSONObject(it) } catch (e: Exception) { null } }

    // ── Alarms on the phone ──
    private fun pending(ctx: Context, action: String, id: String, extras: Intent.() -> Unit = {}): PendingIntent {
        val intent = Intent(ctx, LiveReceiver::class.java).apply {
            this.action = action
            // The data URI makes every moment its own alarm (extras alone don't make intents distinct).
            data = Uri.parse("inchstone://$action/${Uri.encode(id)}")
            extras()
        }
        return PendingIntent.getBroadcast(ctx, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun setAt(ctx: Context, at: Long, pi: PendingIntent, loud: Boolean) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val exactOk = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
        try {
            when {
                // Alarm-clock alarms wake the phone from deep sleep and are never delayed.
                exactOk && loud -> am.setAlarmClock(AlarmManager.AlarmClockInfo(at, openPending(ctx, "/dashboard")), pi)
                exactOk -> am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
                else -> am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            }
        } catch (e: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }

    private fun arm(ctx: Context, json: JSONObject) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = System.currentTimeMillis()
        val want = LinkedHashMap<String, () -> Unit>() // "ACTION|id" → arm it

        val alerts = json.optJSONArray("alerts")
        val alertTimes = HashSet<Long>()
        for (i in 0 until (alerts?.length() ?: 0)) {
            val a = alerts!!.getJSONObject(i)
            val at = ms(a.optString("at")) ?: continue
            if (at <= now) continue
            val id = a.optString("id")
            alertTimes.add(at)
            want["$ACTION_ALERT|$id"] = {
                setAt(ctx, at, pending(ctx, ACTION_ALERT, id) {
                    putExtra("id", id)
                    putExtra("kind", a.optString("kind"))
                    putExtra("title", a.optString("title"))
                    putExtra("body", a.optString("body"))
                    putExtra("url", a.optString("url", "/dashboard"))
                    putExtra("loud", a.optBoolean("loud"))
                    putExtra("taskId", a.optString("taskId", ""))
                }, a.optBoolean("loud"))
            }
        }

        // Quiet card redraws: 15 min before a deed (it becomes "Up next"), at its start and at its end.
        val deeds = json.optJSONArray("deeds")
        for (i in 0 until (deeds?.length() ?: 0)) {
            val d = deeds!!.getJSONObject(i)
            if (d.optBoolean("completed")) continue
            for (at in listOfNotNull(ms(d.optString("start"))?.minus(15 * 60_000L), ms(d.optString("start")), ms(d.optString("end")))) {
                if (at <= now || at in alertTimes) continue
                val id = "${d.optString("id")}-$at"
                want["$ACTION_CARD|$id"] = { setAt(ctx, at, pending(ctx, ACTION_CARD, id), false) }
            }
        }

        // Cancel what is no longer wanted (a deed moved, was ticked off or deleted), then (re)arm the rest.
        val old = prefs(ctx).getString(KEY_ARMED, "")!!.split("\n").filter { it.contains('|') }
        for (key in old) if (key !in want) {
            val (action, id) = key.split("|", limit = 2)
            am.cancel(pending(ctx, action, id))
        }
        for ((_, armIt) in want) armIt()
        prefs(ctx).edit().putString(KEY_ARMED, want.keys.joinToString("\n")).apply()
    }

    private fun armSync(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pending(ctx, ACTION_SYNC, "every-15-min")
        am.cancel(pi)
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + SYNC_EVERY_MS, SYNC_EVERY_MS, pi)
    }

    // ── A moment arrived: one notification, then refresh the card. ──
    fun onAlert(ctx: Context, intent: Intent) {
        val id = intent.getStringExtra("id") ?: return
        val fired = prefs(ctx).getString(KEY_FIRED, "")!!.split("\n").filter { it.isNotEmpty() }.toMutableList()
        if (id in fired) { showCard(ctx); return }
        fired.add(id)
        prefs(ctx).edit().putString(KEY_FIRED, fired.takeLast(300).joinToString("\n")).apply()

        val taskId = intent.getStringExtra("taskId").orEmpty()
        // A deed ticked off since the last sync doesn't announce its start.
        if (taskId.isNotEmpty() && intent.getStringExtra("kind") == "start" && deedCompleted(ctx, taskId)) { showCard(ctx); return }

        ensureChannels(ctx)
        if (canNotify(ctx)) {
            val loud = intent.getBooleanExtra("loud", false)
            val nid = id.hashCode()
            val b = builder(ctx, if (loud) CH_ALARMS else CH_DEEDS)
                .setSmallIcon(R.drawable.ic_stat_inchstone)
                .setContentTitle(intent.getStringExtra("title"))
                .setContentText(intent.getStringExtra("body"))
                .setStyle(Notification.BigTextStyle().bigText(intent.getStringExtra("body")))
                .setAutoCancel(true)
                .setContentIntent(openPending(ctx, intent.getStringExtra("url") ?: "/dashboard"))
                .setCategory(if (loud) Notification.CATEGORY_ALARM else Notification.CATEGORY_REMINDER)
            if (Build.VERSION.SDK_INT < 26) {
                @Suppress("DEPRECATION")
                b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL)
            }
            if (taskId.isNotEmpty()) {
                b.addAction(action(ctx, ACTION_DONE, taskId, "Done ✓", nid))
                b.addAction(action(ctx, ACTION_EXTEND, taskId, "+15 min", nid))
            }
            // A deed's start note tidies itself away; the live card carries on.
            if (!loud && Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(30 * 60_000L)
            ctx.getSystemService(NotificationManager::class.java).notify(nid, b.build())
        }
        showCard(ctx)
    }

    private fun deedCompleted(ctx: Context, taskId: String): Boolean {
        val deeds = cached(ctx)?.optJSONArray("deeds") ?: return false
        for (i in 0 until deeds.length()) {
            val d = deeds.getJSONObject(i)
            if (d.optString("id") == taskId) return d.optBoolean("completed")
        }
        return false
    }

    // ── The always-on card ──
    private class Deed(val id: String, val title: String, val start: Long, val end: Long, val completed: Boolean)

    fun showCard(ctx: Context) {
        ensureChannels(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (!canNotify(ctx)) return
        val arr = cached(ctx)?.optJSONArray("deeds")
        val now = System.currentTimeMillis()
        val today = ArrayList<Deed>()
        for (i in 0 until (arr?.length() ?: 0)) {
            val d = arr!!.getJSONObject(i)
            val start = ms(d.optString("start")) ?: continue
            val end = ms(d.optString("end")) ?: (start + 30 * 60_000L)
            if (!isToday(start) && !(start <= now && now < end)) continue
            today.add(Deed(d.optString("id"), d.optString("title"), start, end, d.optBoolean("completed")))
        }
        today.sortBy { it.start }
        if (today.isEmpty()) { nm.cancel(CARD_ID); return }

        val done = today.count { it.completed }
        val total = today.size
        val running = today.filter { !it.completed && it.start <= now && now < it.end }.minByOrNull { it.end }
        val next = today.filter { !it.completed && it.start > now }.minByOrNull { it.start }
        val focus = running ?: next

        val lines = today.joinToString("\n") { d ->
            val mark = when {
                d.completed -> "✓"
                d.start <= now && now < d.end -> "▶"
                d.end <= now -> "✗"
                else -> "○"
            }
            "$mark ${hhmm(d.start)}  ${d.title}"
        }

        val b = builder(ctx, CH_LIVE)
            .setSmallIcon(R.drawable.ic_stat_inchstone)
            .setOnlyAlertOnce(true)
            .setContentIntent(openPending(ctx, "/dashboard"))
            .setProgress(total, done, false)
            .setStyle(Notification.BigTextStyle().bigText(lines).setSummaryText("$done/$total done"))
        if (Build.VERSION.SDK_INT < 26) {
            @Suppress("DEPRECATION")
            b.setPriority(Notification.PRIORITY_LOW)
        }

        if (focus != null) {
            val isRunning = focus === running
            val target = if (isRunning) focus.end else focus.start
            b.setContentTitle(if (isRunning) "▶ ${focus.title}" else "Up next: ${focus.title}")
                .setContentText(if (isRunning) "Running · ends ${hhmm(focus.end)} · $done/$total done" else "Starts ${hhmm(focus.start)} · $done/$total done")
                .setOngoing(true)
                // Android draws the countdown itself — the card is never re-posted to tick.
                .setWhen(target).setShowWhen(true).setUsesChronometer(true)
                .addAction(action(ctx, ACTION_DONE, focus.id, "Done ✓", 0))
            if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(true)
            if (isRunning) b.addAction(action(ctx, ACTION_EXTEND, focus.id, "+15 min", 0))
            // Android 16: ask to be shown as a Live Update (a chip in the status bar). Ignored before 16.
            b.extras.putBoolean("android.requestPromotedOngoing", true)
            b.extras.putCharSequence("android.shortCriticalText", focus.title.take(10))
        } else {
            b.setContentTitle(if (done == total) "All $total deeds done today ✓" else "$done of $total deeds done today")
                .setContentText("Nothing else scheduled today.")
                .setOngoing(false)
                .setShowWhen(false)
        }
        nm.notify(CARD_ID, b.build())
    }

    // ── Buttons ──
    private fun action(ctx: Context, act: String, taskId: String, label: String, notificationId: Int): Notification.Action {
        val pi = pending(ctx, act, "$taskId/$notificationId") {
            putExtra("taskId", taskId)
            putExtra("notificationId", notificationId)
        }
        return Notification.Action.Builder(null, label, pi).build()
    }

    /** Done / +15 min from the bar: tell Inchstone, then sync so the card and alarms follow. */
    fun actAsync(ctx: Context, intent: Intent, then: () -> Unit) {
        val app = ctx.applicationContext
        val taskId = intent.getStringExtra("taskId").orEmpty()
        val op = if (intent.action == ACTION_DONE) "done" else "extend"
        val nid = intent.getIntExtra("notificationId", 0)
        if (nid != 0) app.getSystemService(NotificationManager::class.java).cancel(nid)
        executor.execute {
            try {
                val secret = WidgetData.secret(app)
                if (!secret.isNullOrEmpty() && taskId.isNotEmpty()) {
                    val conn = URL("https://${WidgetData.host(app)}/api/widget?secret=${enc(secret)}&task=${enc(taskId)}&op=$op")
                        .openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.connectTimeout = 8_000
                    conn.readTimeout = 8_000
                    conn.doOutput = true
                    conn.outputStream.use { it.write(ByteArray(0)) }
                    conn.responseCode
                }
                sync(app)
            } catch (e: Exception) {
                /* offline: the card stays as it was; the next sync shows the truth */
            } finally {
                then()
            }
        }
    }

    // ── Helpers ──
    private fun builder(ctx: Context, channel: String): Notification.Builder =
        if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, channel) else @Suppress("DEPRECATION") Notification.Builder(ctx)

    /** Opens Inchstone (the installed web app, if Chrome installed it) at `path`. */
    private fun openPending(ctx: Context, path: String): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://${WidgetData.host(ctx)}$path")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return PendingIntent.getActivity(ctx, path.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
}
