package com.authsignature.app.scan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

/** Where scanned numbers arrive, from a Zebra scanner or typed in. Screens listen while they are shown. */
object ScanBus {
    private val _scans = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val scans: SharedFlow<String> = _scans
    fun emit(code: String) = _scans.tryEmit(code)
}

/**
 * Zebra handhelds scan through DataWedge. The app asks DataWedge for a profile that sends each scan to
 * it as a broadcast (no keyboard typing), so the scan arrives even when no text box has focus.
 * On other phones nothing answers and nothing happens.
 */
object DataWedge {
    const val SCAN_ACTION = "com.authsignature.app.SCAN"
    private const val API_ACTION = "com.symbol.datawedge.api.ACTION"
    private const val DATA_EXTRA = "com.symbol.datawedge.data_string"

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            intent.getStringExtra(DATA_EXTRA)?.trim()?.takeIf { it.isNotEmpty() }?.let { ScanBus.emit(it) }
        }
    }

    fun register(context: Context) {
        val filter = IntentFilter(SCAN_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiver, filter)
        }
        configure(context)
    }

    fun unregister(context: Context) {
        runCatching { context.unregisterReceiver(receiver) }
    }

    /** Creates or refreshes the DataWedge profile for this app. */
    private fun configure(context: Context) {
        val intentPlugin = Bundle().apply {
            putString("PLUGIN_NAME", "INTENT")
            putString("RESET_CONFIG", "true")
            putBundle(
                "PARAM_LIST",
                Bundle().apply {
                    putString("intent_output_enabled", "true")
                    putString("intent_action", SCAN_ACTION)
                    putString("intent_delivery", "2") // broadcast
                },
            )
        }
        val barcodePlugin = Bundle().apply {
            putString("PLUGIN_NAME", "BARCODE")
            putString("RESET_CONFIG", "true")
            putBundle("PARAM_LIST", Bundle().apply { putString("scanner_input_enabled", "true") })
        }
        val keystrokePlugin = Bundle().apply {
            putString("PLUGIN_NAME", "KEYSTROKE")
            putString("RESET_CONFIG", "true")
            putBundle("PARAM_LIST", Bundle().apply { putString("keystroke_output_enabled", "false") })
        }
        val app = Bundle().apply {
            putString("PACKAGE_NAME", context.packageName)
            putStringArray("ACTIVITY_LIST", arrayOf("*"))
        }
        val profile = Bundle().apply {
            putString("PROFILE_NAME", "AuthSignature")
            putString("PROFILE_ENABLED", "true")
            putString("CONFIG_MODE", "CREATE_IF_NOT_EXIST")
            putParcelableArray("PLUGIN_CONFIG", arrayOf(barcodePlugin, intentPlugin, keystrokePlugin))
            putParcelableArray("APP_LIST", arrayOf(app))
        }
        context.sendBroadcast(Intent(API_ACTION).apply { putExtra("com.symbol.datawedge.api.SET_CONFIG", profile) })
    }
}
