package com.authsignature.app.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.authsignature.app.container

/** Starts the background alerts again after the phone restarts, if the person turned them on. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val store = context.container.store
        if (store.backgroundAlerts && store.token != null) AlertService.start(context)
    }
}
