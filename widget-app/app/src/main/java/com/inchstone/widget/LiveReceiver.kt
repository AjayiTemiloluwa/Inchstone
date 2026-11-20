package com.inchstone.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * LiveReceiver — wakes up for the phone's own alarms and for system events.
 *
 *  · ALERT   → a moment arrived (deed start, reminder, alarm, deadline): notify + refresh the card
 *  · CARD    → a deed became "up next", started or ended: quietly redraw the card
 *  · SYNC    → every ~15 min: download the schedule again
 *  · DONE / EXTEND → buttons on the card or a start note
 *
 * Not exported: only this app's own alarms and buttons reach it. System events go to
 * SystemEventsReceiver below.
 */
class LiveReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Live.ACTION_ALERT -> Live.onAlert(context, intent)
            Live.ACTION_CARD -> Live.showCard(context)
            Live.ACTION_DONE, Live.ACTION_EXTEND -> {
                val pending = goAsync()
                Live.actAsync(context, intent) { pending.finish() }
            }
            Live.ACTION_SYNC -> {
                val pending = goAsync()
                Live.syncAsync(context) { pending.finish() }
            }
        }
    }
}

/** Restart, app update or clock change: alarms were wiped or shifted, so re-arm (system broadcasts only). */
class SystemEventsReceiver : BroadcastReceiver() {
    private val allowed = setOf(
        Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
    )

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in allowed) return
        val pending = goAsync()
        Live.syncAsync(context) { pending.finish() }
    }
}
