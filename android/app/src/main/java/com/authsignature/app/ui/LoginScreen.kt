package com.authsignature.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.sound.Tone
import kotlinx.coroutines.launch

/** A password box with a show/hide button. */
@Composable
fun PasswordField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    imeAction: ImeAction = ImeAction.Next,
    onDone: () -> Unit = {},
) {
    var shown by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        visualTransformation = if (shown) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction),
        keyboardActions = KeyboardActions(onDone = { onDone() }, onGo = { onDone() }),
        trailingIcon = {
            IconButton(onClick = { shown = !shown }) {
                Icon(if (shown) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, contentDescription = com.authsignature.app.i18n.t(if (shown) "Hide password" else "Show password"))
            }
        },
    )
}

@Composable
private fun BrandHeader() {
    Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.primary, modifier = Modifier.size(60.dp)) {
        Box(contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.VerifiedUser, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(34.dp))
        }
    }
    Spacer(Modifier.height(12.dp))
    Text("Auth Signature", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
}

@Composable
fun LoginScreen() {
    val container = LocalContext.current.container
    val scope = rememberCoroutineScope()
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var forgot by remember { mutableStateOf(false) }

    fun submit() {
        if (busy || email.isBlank() || password.isEmpty()) return
        busy = true
        error = null
        scope.launch {
            try {
                container.signIn(email, password)
            } catch (e: ApiException) {
                error = e.message
                container.signal(Tone.Error)
            } finally {
                busy = false
            }
        }
    }

    Box(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
        Column(
            Modifier.align(Alignment.Center).widthIn(max = 440.dp).verticalScroll(rememberScrollState()).padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandHeader()
            Spacer(Modifier.height(12.dp))
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("sv" to "Svenska", "en" to "English").forEach { (code, name) ->
                    if (com.authsignature.app.i18n.I18n.lang == code) {
                        Button(onClick = { container.setLanguage(code) }, shape = RoundedCornerShape(10.dp)) { Text(name) }
                    } else {
                        OutlinedButton(onClick = { container.setLanguage(code) }, shape = RoundedCornerShape(10.dp)) { Text(name) }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            AppCard {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Sign in", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text("Use the account your admin gave you.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                    )
                    PasswordField("Password", password, { password = it }, imeAction = ImeAction.Go, onDone = ::submit)
                    error?.let { ErrorNote(it) }
                    Button(onClick = ::submit, enabled = !busy, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(12.dp)) {
                        Text(if (busy) "Signing in…" else "Sign in")
                    }
                }
            }
            TextButton(onClick = { forgot = true }, modifier = Modifier.padding(top = 8.dp)) { Text("Forgot password?") }
        }
    }

    if (forgot) ForgotDialog(initialEmail = email) { forgot = false }
}

/** Asks the people who reset passwords to give this account a temporary password. */
@Composable
private fun ForgotDialog(initialEmail: String, onDismiss: () -> Unit) {
    val container = LocalContext.current.container
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf(initialEmail) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Forgot password") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Enter your email. The admin is notified and will give you a temporary password.", style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                )
                message?.let { SuccessNote(it) }
                error?.let { ErrorNote(it) }
            }
        },
        confirmButton = {
            Button(
                enabled = !busy && email.isNotBlank() && message == null,
                onClick = {
                    busy = true
                    error = null
                    scope.launch {
                        try {
                            message = container.api.forgot(email.trim()).message ?: "The admin has been notified."
                            container.signal(Tone.Sent)
                        } catch (e: ApiException) {
                            error = e.message
                            container.signal(Tone.Error)
                        } finally {
                            busy = false
                        }
                    }
                },
            ) { Text(if (busy) "Sending…" else "Notify the admin") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Close") } },
    )
}

/** Shown after an admin created or reset the account: the person must choose their own password first. */
@Composable
fun ForcedPasswordScreen() {
    val container = LocalContext.current.container
    val scope = rememberCoroutineScope()
    var current by rememberSaveable { mutableStateOf("") }
    var next by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun submit() {
        if (busy) return
        busy = true
        error = null
        scope.launch {
            try {
                container.changePassword(current, next, confirm)
                container.signal(Tone.Done)
            } catch (e: ApiException) {
                error = e.message
                container.signal(Tone.Error)
            } finally {
                busy = false
            }
        }
    }

    Box(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
        Column(
            Modifier.align(Alignment.Center).widthIn(max = 440.dp).verticalScroll(rememberScrollState()).padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandHeader()
            Spacer(Modifier.height(24.dp))
            AppCard {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Choose a new password", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text(
                        "You need to choose your own password before you can continue.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    PasswordField("Current (temporary) password", current, { current = it })
                    PasswordField("New password (min 8)", next, { next = it })
                    PasswordField("Repeat new password", confirm, { confirm = it }, imeAction = ImeAction.Done, onDone = ::submit)
                    error?.let { ErrorNote(it) }
                    Button(onClick = ::submit, enabled = !busy, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(12.dp)) {
                        Text(if (busy) "Saving…" else "Change password")
                    }
                    OutlinedButton(onClick = { container.signOut() }, modifier = Modifier.fillMaxWidth()) { Text("Sign out") }
                }
            }
        }
    }
}
