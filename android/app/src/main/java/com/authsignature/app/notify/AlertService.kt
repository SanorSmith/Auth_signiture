package com.authsignature.app.notify

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import com.authsignature.app.container
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/** True while one of the app's screens is on screen. */
fun appInForeground() = ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)

/**
 * Keeps the notification check running while the app is closed, so alerts arrive without any
 * Google service. Android shows a small ongoing notification for as long as it runs.
 */
class AlertService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var listener: Job? = null
    private var wakeLock: android.os.PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, NotificationHelper.serviceNotification(this))
        val container = applicationContext.container
        if (container.store.token == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        // Keeps the processor awake with the screen off, so the check does not pause between rounds.
        if (wakeLock == null) {
            val power = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            wakeLock = power.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "authsignature:alerts").apply { acquire() }
        }
        container.poller.start()
        if (listener?.isActive != true) {
            listener = scope.launch {
                container.poller.events.collect { notice ->
                    // With the app open the screens play the tone themselves; this is for when it is closed.
                    if (!appInForeground()) NotificationHelper.show(applicationContext, notice)
                }
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        runCatching { wakeLock?.release() }
        wakeLock = null
        if (!appInForeground()) applicationContext.container.poller.stop()
        super.onDestroy()
    }

    companion object {
        private const val NOTIFICATION_ID = 1

        fun start(context: Context) =
            ContextCompat.startForegroundService(context, Intent(context, AlertService::class.java))

        fun stop(context: Context) {
            context.stopService(Intent(context, AlertService::class.java))
        }
    }
}
