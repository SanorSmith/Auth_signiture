package com.authsignature.app.notify

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.authsignature.app.MainActivity
import com.authsignature.app.R
import com.authsignature.app.data.Notice

/**
 * System notifications for when the app is closed. They use the device's own default notification
 * sound, and each kind has its own channel so it can be tuned in the phone's settings.
 */
object NotificationHelper {
    private const val CHANNEL_REQUESTS = "requests"
    private const val CHANNEL_CODES = "codes"
    private const val CHANNEL_ACCOUNT = "account"
    const val CHANNEL_SERVICE = "background_service"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_REQUESTS, "New requests", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "A client asked for a verification code"
                enableVibration(true)
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_CODES, "Your requests", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Your code is ready, or your request was denied or removed"
                enableVibration(true)
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ACCOUNT, "Account", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Password reset requests and changes to your access"
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_SERVICE, "Background alerts", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Shown while the app checks for notifications in the background"
                setShowBadge(false)
            },
        )
    }

    private fun channelFor(kind: String) = when (kind) {
        "new_request" -> CHANNEL_REQUESTS
        "code_issued", "request_denied", "request_removed" -> CHANNEL_CODES
        else -> CHANNEL_ACCOUNT
    }

    private fun canNotify(context: Context) =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun openApp(context: Context, notice: Notice?): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            notice?.let { putExtra(MainActivity.EXTRA_URL, it.url) }
        }
        return PendingIntent.getActivity(
            context,
            notice?.id?.toInt() ?: 0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    fun show(context: Context, notice: Notice) {
        if (!canNotify(context)) return
        val notification = NotificationCompat.Builder(context, channelFor(notice.kind))
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(notice.title)
            .setContentText(notice.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(notice.body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(openApp(context, notice))
            .build()
        context.getSystemService(NotificationManager::class.java).notify(notice.id.toInt(), notification)
    }

    fun serviceNotification(context: Context) =
        NotificationCompat.Builder(context, CHANNEL_SERVICE)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Auth Signature")
            .setContentText("Watching for new requests and codes")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(openApp(context, null))
            .build()
}
