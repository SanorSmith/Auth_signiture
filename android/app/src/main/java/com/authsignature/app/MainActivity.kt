package com.authsignature.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.authsignature.app.notify.AlertService
import com.authsignature.app.scan.DataWedge
import com.authsignature.app.ui.AuthTheme
import com.authsignature.app.ui.ForcedPasswordScreen
import com.authsignature.app.ui.LoginScreen
import com.authsignature.app.ui.MainScaffold

class MainActivity : ComponentActivity() {
    private val openUrl = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        openUrl.value = intent?.getStringExtra(EXTRA_URL)
        DataWedge.register(this)
        setContent {
            AuthTheme {
                Box(Modifier.fillMaxSize()) {
                    AppRoot(openUrl.value) { openUrl.value = null }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        openUrl.value = intent.getStringExtra(EXTRA_URL)
    }

    override fun onStart() {
        super.onStart()
        val container = applicationContext.container
        // While a screen is showing the app checks for notifications itself.
        if (container.store.token != null) container.poller.start()
    }

    override fun onStop() {
        super.onStop()
        val container = applicationContext.container
        // With background alerts on, the service keeps checking; otherwise stop to save battery.
        if (!container.store.backgroundAlerts) container.poller.stop()
    }

    override fun onDestroy() {
        DataWedge.unregister(this)
        super.onDestroy()
    }

    companion object {
        const val EXTRA_URL = "open_url"
    }
}

@Composable
private fun AppRoot(openUrl: String?, onUrlHandled: () -> Unit) {
    val container = LocalContext.current.container
    val user by container.user.collectAsState()
    val current = user

    // Start watching for notifications as soon as someone is signed in.
    LaunchedEffect(current?.id) {
        if (current != null) {
            container.poller.start()
            if (container.store.backgroundAlerts) AlertService.start(container.app)
        }
    }

    Box(Modifier.fillMaxSize().then(Modifier)) {
        when {
            current == null -> LoginScreen()
            current.mustChange -> ForcedPasswordScreen()
            else -> MainScaffold(current, openUrl, onUrlHandled)
        }
    }
}
