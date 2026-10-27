package com.authsignature.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.authsignature.app.BuildConfig
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.Permissions
import com.authsignature.app.data.User
import com.authsignature.app.notify.AlertService
import com.authsignature.app.sound.Tone
import com.authsignature.app.sound.Tones
import kotlinx.coroutines.launch

private fun relevant(tone: Tone, u: User) = when (tone) {
    Tone.NewRequest -> u.can("manage_requests")
    Tone.ResetRequested -> u.can("reset_passwords")
    Tone.CodeIssued, Tone.RequestDenied, Tone.RequestRemoved, Tone.Sent -> u.can("request")
    Tone.Found, Tone.Missing -> u.can("monitor")
    Tone.Counted, Tone.Duplicate, Tone.Mismatch, Tone.Finished -> u.can("colli_counter")
    else -> true
}

/** The signed-in person, their password, sounds, background alerts, and sign out. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AccountScreen(user: User) {
    val context = LocalContext.current
    val container = context.container
    val scope = rememberCoroutineScope()

    var sound by remember { mutableStateOf(container.store.sound) }
    var background by remember { mutableStateOf(container.store.backgroundAlerts) }
    var showTones by remember { mutableStateOf(false) }

    var current by rememberSaveable { mutableStateOf("") }
    var next by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var passwordOk by remember { mutableStateOf<String?>(null) }

    fun startBackground() {
        container.store.backgroundAlerts = true
        background = true
        AlertService.start(context)
    }

    val askNotifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        // Without the permission Android hides the alerts, so only turn background alerts on when it is granted.
        if (granted) startBackground()
    }

    fun setBackground(on: Boolean) {
        if (!on) {
            container.store.backgroundAlerts = false
            background = false
            AlertService.stop(context)
            return
        }
        val needsPermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        if (needsPermission) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS) else startBackground()
    }

    fun changePassword() {
        if (busy) return
        busy = true
        passwordError = null
        passwordOk = null
        scope.launch {
            try {
                container.changePassword(current, next, confirm)
                passwordOk = "Password changed."
                current = ""
                next = ""
                confirm = ""
                container.signal(Tone.Done)
            } catch (e: ApiException) {
                passwordError = e.message
                container.signal(Tone.Error)
            } finally {
                busy = false
            }
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AppCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(user.email, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (user.isAdmin) Chip("Administrator") else user.perms.forEach { Chip(Permissions.label(it)) }
                }
            }
        }

        if (user.isAdmin) {
            var noteOn by remember { mutableStateOf<Boolean?>(null) }
            var noteError by remember { mutableStateOf<String?>(null) }
            LaunchedEffect(Unit) {
                try {
                    noteOn = container.api.counterState().noteCompare
                } catch (_: Exception) {
                }
            }
            AppCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Colli counter", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    SwitchRow(
                        "Compare with delivery note",
                        "Users photograph the delivery note, an AI model reads the package IDs, and they are compared with the scanned packages. The photo is not stored, and the IDs are removed when the count ends.",
                        noteOn == true,
                    ) { wanted ->
                        scope.launch {
                            try {
                                noteError = null
                                noteOn = container.api.counterNoteSetting(wanted).noteCompare
                                container.signal(Tone.Done)
                            } catch (e: ApiException) {
                                noteError = e.message
                                container.signal(Tone.Error)
                            }
                        }
                    }
                    noteError?.let { ErrorNote(it) }
                }
            }
        }

        AppCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Language", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("sv" to "Svenska", "en" to "English").forEach { (code, name) ->
                        if (com.authsignature.app.i18n.I18n.lang == code) {
                            Button(onClick = { container.setLanguage(code) }, shape = RoundedCornerShape(10.dp)) { Text(name) }
                        } else {
                            OutlinedButton(onClick = { container.setLanguage(code) }, shape = RoundedCornerShape(10.dp)) { Text(name) }
                        }
                    }
                }
            }
        }

        AppCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Sounds and alerts", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                SwitchRow("Play sounds", "A different tone for each notification and action", sound) {
                    sound = it
                    container.store.sound = it
                }
                var silence by remember { mutableStateOf<String?>(null) }
                OutlinedButton(
                    onClick = { silence = Tones.silenceReason(context); Tones.play(Tone.NewRequest); Tones.vibrate(context, Tone.NewRequest) },
                    shape = RoundedCornerShape(10.dp),
                ) { Text("Test sound") }
                silence?.let { ErrorNote(it) }
                val checkStatus by container.poller.status.collectAsState()
                Text("Notification check: $checkStatus", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                SwitchRow("Alerts when the app is closed", "Keeps checking for new requests and codes. Android shows a small ongoing notification.", background, ::setBackground)
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                TextButton(onClick = { showTones = !showTones }) { Text(if (showTones) "Hide the tones" else "Hear the tones") }
                if (showTones) {
                    Tone.entries.filter { relevant(it, user) }.forEach { tone ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(tone.label, style = MaterialTheme.typography.bodyMedium)
                                Text("${tone.hint} · ${"%.1f".format(Tones.seconds(tone))} s", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            OutlinedButton(onClick = { Tones.play(tone); Tones.vibrate(context, tone) }, shape = RoundedCornerShape(10.dp)) { Text("Play") }
                        }
                    }
                }
            }
        }

        AppCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Change password", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                PasswordField("Current password", current, { current = it })
                PasswordField("New password (min 8)", next, { next = it })
                PasswordField("Repeat new password", confirm, { confirm = it }, imeAction = ImeAction.Done, onDone = ::changePassword)
                passwordError?.let { ErrorNote(it) }
                passwordOk?.let { SuccessNote(it) }
                Button(onClick = ::changePassword, enabled = !busy, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) {
                    Text(if (busy) "Saving…" else "Change password")
                }
            }
        }

        OutlinedButton(
            onClick = { container.signOut() },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(12.dp),
        ) { Text("Sign out") }

        Text(
            "Auth Signature ${BuildConfig.VERSION_NAME}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

@Composable
private fun Chip(text: String) {
    Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primaryContainer) {
        Text(text, modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
    }
}

@Composable
private fun SwitchRow(title: String, hint: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
