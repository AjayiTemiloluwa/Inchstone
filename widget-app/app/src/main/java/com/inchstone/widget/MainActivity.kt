package com.inchstone.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

/**
 * MainActivity — pairing + config.
 *
 * 1. Paste the widget secret from the web app (Settings → Widget).
 * 2. Pick your Inchstone server URL (defaults to the production host).
 * 3. Save → the widget refreshes with your configured pages.
 *
 * The pages themselves (which pages, order, styles, toggles) are designed in
 * the web app — this screen only pairs the device.
 */
class MainActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val pad = (16 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            setBackgroundColor(0xFF0A0908.toInt())
        }

        val title = TextView(this).apply {
            text = "Inchstone Widget"
            textSize = 22f
            setTextColor(0xFFF3EFE6.toInt())
        }
        val hint = TextView(this).apply {
            text = "1. Open Inchstone → Settings → Widget\n2. Copy your pairing secret\n3. Paste it below"
            textSize = 14f
            setTextColor(0xFFB8B2A6.toInt())
            setPadding(0, pad / 2, 0, pad / 2)
        }
        val input = EditText(this).apply {
            hint = "Pairing secret"
            setTextColor(0xFFF3EFE6.toInt())
            setHintTextColor(0xFF8A8378.toInt())
        }
        val hostInput = EditText(this).apply {
            hint = "Server (e.g. inchstone.vercel.app)"
            setTextColor(0xFFF3EFE6.toInt())
            setHintTextColor(0xFF8A8378.toInt())
        }
        val status = TextView(this).apply {
            textSize = 13f
            setTextColor(0xFFB8935A.toInt())
        }
        val save = Button(this).apply { text = "Pair & refresh" }

        root.addView(title)
        root.addView(hint)
        root.addView(input)
        root.addView(hostInput)
        root.addView(status)
        root.addView(save)
        setContentView(root)

        WidgetData.secret(this)?.let { input.setText(it) }
        WidgetData.host(this).takeIf { it != WidgetData.DEFAULT_HOST }?.let { hostInput.setText(it) }

        // When launched as the widget's configure step (user just added the
        // widget), we must always return the widget id with a result code —
        // otherwise the launcher cancels the add.
        val widgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            setResult(RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
        }

        save.setOnClickListener {
            val secret = input.text.toString().trim()
            if (secret.isEmpty()) {
                status.text = "Paste the secret first."
                return@setOnClickListener
            }
            status.text = "Pairing…"
            save.isEnabled = false
            WidgetData.saveHost(this, hostInput.text.toString())
            WidgetData.saveSecret(this, secret)
            WidgetData.refreshAsync(this) {
                runOnUiThread {
                    save.isEnabled = true
                    val paired = WidgetData.cachedJson(this) != null
                    status.text = if (paired) "Paired ✓ — add the widget to your home screen."
                    else "Couldn't reach Inchstone — check the secret / connection."
                    // Tell any existing widgets to redraw
                    val manager = AppWidgetManager.getInstance(this)
                    val ids = manager.getAppWidgetIds(ComponentName(this, InchstoneWidgetProvider::class.java))
                    for (id in ids) render(this, manager, id)
                    // If we're the widget's configure step, hand the widget
                    // back to the launcher now that we're paired.
                    if (paired && widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                        setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
                        finish()
                    }
                }
            }
        }
    }
}